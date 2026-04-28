(function () {
  "use strict";

  const state = {
    routes: [],
    selectedRouteId: null,
    recommendedRouteId: null,
    fastestRouteId: null,
    aiPanel: null,
    loading: false,
    map: null,
    routeLayers: {},
  };

  const STORAGE_KEYS = {
    history: "scl-history",
    alerts: "scl-alerts",
    lastAnalysis: "scl-last-analysis",
  };

  const $ = (id) => document.getElementById(id);

  const refs = {
    form: $("route-form"),
    source: $("input-source"),
    destination: $("input-destination"),
    mode: $("delivery-type"),
    analyzeBtn: $("analyze-btn"),
    demoPresets: $("demo-route-presets"),
    routeCards: $("route-cards"),
    alertBanner: $("alert-banner"),
    alertText: $("alert-text"),
    alertClose: $("alert-close"),
    sidebar: $("sidebar"),
    hamburger: $("hamburger-btn"),
    map: $("map"),
    aiPanel: $("ai-panel"),
    aiToggle: $("ai-panel-toggle"),
    aiClose: $("ai-panel-close"),
    scoreNumber: $("risk-score-number"),
    scoreBadge: $("risk-score-badge"),
    scoreSub: $("risk-score-sub"),
    factors: $("risk-factors"),
    confidenceValue: $("confidence-value"),
    confidenceFill: $("confidence-fill"),
    recHeadline: $("rec-headline"),
    recBody: $("rec-body"),
    explainList: $("explain-list"),
    recAcceptBtn: $("rec-accept-btn"),
    sidebarAlerts: $("sidebar-alerts"),
    sidebarHistory: $("sidebar-history"),
    sidebarSettings: $("sidebar-settings"),
    mapZoomIn: $("map-zoom-in"),
    mapZoomOut: $("map-zoom-out"),
    mapReset: $("map-reset-view"),
    statusLabel: document.querySelector(".status-label"),
    alertBadge: document.querySelector("#sidebar-alerts .sidebar-nav__badge"),
  };

  const DEMO_ROUTES = {
    "urban-relief": {
      source: "Mumbai",
      destination: "Pune",
      mode: "driving",
      label: "Urban medical relay",
    },
    "storm-corridor": {
      source: "Chennai",
      destination: "Puducherry",
      mode: "driving",
      label: "Coastal storm corridor",
    },
    "hill-route": {
      source: "Guwahati",
      destination: "Shillong",
      mode: "driving",
      label: "Hill access route",
    },
  };

  function getRiskClass(score) {
    if (score >= 75) return "high";
    if (score >= 45) return "medium";
    return "low";
  }

  /**
   * Get risk-based color for route visualization.
   * Green (0-34): Safe, low risk
   * Orange (35-64): Moderate risk, caution advised
   * Red (65-100): High risk, avoid if possible
   */
  function getRiskColor(score) {
    if (score < 35) return "#10b981"; // Green - Safe
    if (score < 65) return "#f59e0b"; // Orange - Moderate
    return "#ef4444"; // Red - High risk
  }

  function getRiskLabel(score) {
    if (score < 15) return "Minimal";
    if (score < 35) return "Low";
    if (score < 60) return "Moderate";
    if (score < 80) return "High";
    return "Critical";
  }

  function showAlert(message, type = "warning") {
    if (!refs.alertBanner || !refs.alertText) return;
    refs.alertText.textContent = message;
    refs.alertBanner.className = `alert-banner alert-banner--${type}`;
    refs.alertBanner.hidden = false;
  }

  function hideAlert() {
    if (refs.alertBanner) refs.alertBanner.hidden = true;
  }

  function loadJson(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch (_) {
      return fallback;
    }
  }

  function saveJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function saveHistory(route) {
    const history = loadJson(STORAGE_KEYS.history, []);
    history.unshift({
      route: route.routeName || route.name || route.label || route.id,
      score: route.riskScore,
      level: route.riskLevel,
      eta: route.etaText,
      source: refs.source?.value || "",
      destination: refs.destination?.value || "",
      timestamp: new Date().toLocaleString(),
    });
    saveJson(STORAGE_KEYS.history, history.slice(0, 20));
  }

  function addAlertsForRoute(route) {
    const alerts = loadJson(STORAGE_KEYS.alerts, []);
    const next = [];
    const displayName = route.routeName || route.name || route.label || route.id;

    if (route.riskScore >= 75) next.push(`Avoid ${displayName}: current disruption risk is high.`);
    if (route.weatherCondition) next.push(`${displayName}: ${route.weatherCondition} on corridor.`);
    if (route.delayMinutes >= 10) next.push(`${displayName}: traffic delay estimate is ${route.delayMinutes} mins.`);

    saveJson(STORAGE_KEYS.alerts, [...next, ...alerts].slice(0, 25));
    updateAlertBadge();
  }

  function updateAlertBadge() {
    const alerts = loadJson(STORAGE_KEYS.alerts, []);
    if (refs.alertBadge) refs.alertBadge.textContent = alerts.length ? String(Math.min(alerts.length, 99)) : "";
  }

  function showModal(title, bodyHtml) {
    document.querySelector(".notify-modal-overlay")?.remove();
    const overlay = document.createElement("div");
    overlay.className = "notify-modal-overlay";
    overlay.innerHTML = `<div class="notify-modal" style="max-width:520px;width:92%">
      <p class="notify-modal__title">${title}</p>
      <div class="notify-modal__body" style="max-height:55vh;overflow-y:auto;text-align:left">${bodyHtml}</div>
      <div class="notify-modal__footer"><button class="btn btn--primary btn--sm" id="notify-close">Close</button></div>
    </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("#notify-close")?.addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) overlay.remove();
    });
  }

  function openHistory() {
    const history = loadJson(STORAGE_KEYS.history, []);
    const body = history.length
      ? history
          .map(
            (item) => `<div style="padding:10px 0;border-bottom:1px solid var(--clr-border)">
          <strong>${item.route}</strong><br>
          <span style="font-size:12px;color:var(--clr-text-secondary)">${item.source} → ${item.destination} | ${item.level} (${item.score}) | ETA ${item.eta} | ${item.timestamp}</span>
        </div>`
          )
          .join("")
      : '<p style="color:var(--clr-text-muted)">No route analyses saved yet.</p>';
    showModal("Route History", body);
  }

  function openAlerts() {
    const alerts = loadJson(STORAGE_KEYS.alerts, []);
    const body = alerts.length
      ? alerts
          .map(
            (alert) => `<div style="padding:8px 0;border-bottom:1px solid var(--clr-border);color:var(--clr-risk-high)">${alert}</div>`
          )
          .join("")
      : '<p style="color:var(--clr-text-muted)">No active alerts right now.</p>';
    showModal("Active Alerts", body);
  }

  function openSettings() {
    showModal(
      "System Status",
      `<p>Backend integration is active. Route risk, rerouting, explainability, and scenario simulation are now powered by the API.</p>
       <p style="margin-top:12px;color:var(--clr-text-secondary)">Theme settings remain available from the navbar toggle.</p>`
    );
  }

  function initMap() {
    if (!refs.map || typeof window.L === "undefined" || state.map) return;
    state.map = window.L.map(refs.map, { zoomControl: false }).setView([20.5937, 78.9629], 5);
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 18,
    }).addTo(state.map);
    window.L.control.zoom({ position: "topright" }).addTo(state.map);
    
    // Add color-coded risk legend
    const legend = window.L.control({ position: "bottomleft" });
    legend.onAdd = function() {
      const div = window.L.DomUtil.create("div", "map-legend");
      div.innerHTML = `
        <div style="background:white;padding:10px 12px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.15);font-size:12px;font-family:system-ui;">
          <div style="font-weight:600;margin-bottom:6px;color:#1e293b;">Route Risk Level</div>
          <div style="display:flex;align-items:center;margin:4px 0;">
            <div style="width:20px;height:4px;background:#10b981;border-radius:2px;margin-right:8px;"></div>
            <span style="color:#475569;">Low (0-34)</span>
          </div>
          <div style="display:flex;align-items:center;margin:4px 0;">
            <div style="width:20px;height:4px;background:#f59e0b;border-radius:2px;margin-right:8px;"></div>
            <span style="color:#475569;">Moderate (35-64)</span>
          </div>
          <div style="display:flex;align-items:center;margin:4px 0;">
            <div style="width:20px;height:4px;background:#ef4444;border-radius:2px;margin-right:8px;"></div>
            <span style="color:#475569;">High (65+)</span>
          </div>
        </div>
      `;
      return div;
    };
    legend.addTo(state.map);
    
    // Expose instance globally so global.js can call invalidateSize on panel resize
    window._sclMap = state.map;
    // Force Leaflet to recalculate container size after DOM is fully rendered
    setTimeout(() => {
      try { state.map.invalidateSize(); } catch (_) {}
    }, 200);
  }

  function clearRouteLayers() {
    Object.values(state.routeLayers).forEach((layer) => {
      try {
        state.map?.removeLayer(layer);
      } catch (_) {}
    });
    state.routeLayers = {};
  }

  function drawRoutes(fitSelection) {
    if (!state.map) return;
    clearRouteLayers();

    const allCoords = [];

    state.routes.forEach((route) => {
      if (!route.coords || route.coords.length < 2) return;
      const selected = route.id === state.selectedRouteId;
      
      // Use risk-based color coding: Green (safe) → Orange (moderate) → Red (high risk)
      const riskColor = getRiskColor(route.riskScore || 0);

      // Normalize coords: accept both [[lat,lng]] and [{lat,lng}] formats
      const latLngs = route.coords.map((c) =>
        Array.isArray(c) ? [c[0], c[1]] : [c.lat, c.lng]
      );

      const layer = window.L.polyline(latLngs, {
        color: riskColor,
        weight: selected ? 7 : 4,
        opacity: selected ? 1.0 : 0.6,
        className: selected ? 'route-selected' : 'route-normal',
      }).addTo(state.map);

      if (selected) layer.bringToFront();

      const routeDisplayName = route.routeName || route.name || route.label || route.id;
      const riskLevelText = route.riskLevel || getRiskLabel(route.riskScore || 0);
      
      // Enhanced popup with color-coded risk indicator
      const riskBadgeColor = riskColor;
      layer.bindPopup(
        `<div style="font-family:system-ui;">
          <strong style="font-size:14px;">${routeDisplayName}</strong><br>
          <div style="margin:6px 0;padding:4px 8px;background:${riskBadgeColor};color:white;border-radius:4px;display:inline-block;font-size:12px;font-weight:600;">
            ${riskLevelText} Risk (${route.riskScore || 0}/100)
          </div><br>
          <span style="font-size:13px;">⏱ ETA: ${route.etaText || route.eta + " mins" || "N/A"}</span><br>
          <span style="font-size:13px;">📍 Distance: ${route.distanceText || route.distance || "N/A"}</span><br>
          <span style="font-size:12px;color:#64748b;">🌤 ${route.weatherCondition || "N/A"} | 🚗 ${route.trafficLevel || "N/A"} traffic</span>
        </div>`
      );

      state.routeLayers[route.id] = layer;
      latLngs.forEach((c) => allCoords.push(c));
    });

    if (fitSelection) {
      const selectedLayer = state.routeLayers[state.selectedRouteId];
      if (selectedLayer) {
        try {
          state.map.fitBounds(selectedLayer.getBounds(), { padding: [40, 40], maxZoom: 11 });
        } catch (_) {}
      }
    } else if (allCoords.length >= 2) {
      try {
        state.map.fitBounds(window.L.latLngBounds(allCoords), { padding: [40, 40], maxZoom: 10 });
      } catch (_) {}
    }
  }

  function renderRouteCards() {
    if (!refs.routeCards) return;
    refs.routeCards.innerHTML = "";

    if (!state.routes.length) {
      refs.routeCards.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:40px 20px;color:var(--text-secondary);">
          <div style="font-size:48px;margin-bottom:12px;">🗺️</div>
          <div style="font-size:16px;font-weight:500;margin-bottom:8px;">No routes analyzed yet</div>
          <div style="font-size:14px;">Enter source and destination above to get started</div>
        </div>
      `;
      return;
    }

    state.routes.forEach((route) => {
      const selected = route.id === state.selectedRouteId;
      const riskClass = getRiskClass(route.riskScore);
      const badgeParts = [route.riskLevel];
      if (route.isRecommended) badgeParts.push("Safer");
      if (route.isFastest) badgeParts.push("Fastest");

      const card = document.createElement("article");
      card.className = `route-card${selected ? " is-selected active" : ""}${route.isRecommended ? " is-recommended" : ""}`;
      card.dataset.routeId = route.id;
      card.tabIndex = 0;
      card.innerHTML = `
        <div class="route-card__header">
          <span class="route-card__label">${route.label}</span>
          <span class="risk-badge risk-badge--${riskClass}">${badgeParts.join(" · ")}</span>
        </div>
        <div class="route-card__body">
          <p class="route-card__name">${route.name}</p>
          <div class="route-card__meta">
            <span class="route-card__meta-item">ETA ${route.etaText}</span>
            <span class="route-card__meta-item">${route.distanceText}</span>
          </div>
          <div class="route-card__meta" style="margin-top:8px">
            <span class="route-card__meta-item">${route.weatherCondition}</span>
            <span class="route-card__meta-item">${route.trafficLevel} traffic</span>
          </div>
        </div>
        <div class="route-card__footer">
          <button class="btn ${route.isRecommended ? "btn--primary" : "btn--ghost"} btn--sm" data-select-route="${route.id}">
            ${selected ? "Selected" : "View Route"}
          </button>
        </div>`;

      const select = () => selectRoute(route.id, true);
      card.addEventListener("click", (event) => {
        if (!event.target.closest("button")) select();
      });
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          select();
        }
      });
      card.querySelector("button")?.addEventListener("click", (event) => {
        event.stopPropagation();
        select();
      });

      refs.routeCards.appendChild(card);
    });
  }

  function renderAiPanel() {
    if (!state.aiPanel) return;
    const panel = state.aiPanel;
    const riskClass = getRiskClass(panel.riskScore);

    if (refs.scoreNumber) {
      refs.scoreNumber.textContent = panel.riskScore;
      refs.scoreNumber.className = `risk-score-number risk-score-number--${riskClass}`;
    }
    if (refs.scoreBadge) {
      refs.scoreBadge.textContent = panel.riskLevel || getRiskLabel(panel.riskScore);
      refs.scoreBadge.className = `risk-badge risk-badge--${riskClass}`;
    }
    if (refs.scoreSub) {
      const selected = state.routes.find((route) => route.id === state.selectedRouteId);
      const displayName = selected ? (selected.routeName || selected.name || selected.label || selected.id) : null;
      refs.scoreSub.textContent = displayName ? `${displayName} selected` : "Awaiting analysis";
    }
    if (refs.factors) {
      refs.factors.innerHTML = Object.entries(panel.factors || {})
        .map(
          ([label, value]) => `<div class="risk-factor-row">
            <span class="risk-factor-label">${label}</span>
            <div class="risk-factor-bar-track" role="progressbar" aria-valuenow="${value}" aria-valuemin="0" aria-valuemax="100">
              <div class="risk-factor-bar-fill" style="width:${value}%;background:${getRiskColor(value)}"></div>
            </div>
            <span class="risk-factor-val">${value}</span>
          </div>`
        )
        .join("");
    }
    if (refs.confidenceValue) refs.confidenceValue.textContent = `${panel.confidence || 0}%`;
    if (refs.confidenceFill) refs.confidenceFill.style.width = `${panel.confidence || 0}%`;
    if (refs.recHeadline) refs.recHeadline.textContent = panel.recommendation?.headline || "No recommendation yet";
    if (refs.recBody) refs.recBody.textContent = panel.recommendation?.body || "";
    if (refs.explainList) {
      refs.explainList.innerHTML = (panel.explanations || [])
        .map(
          (item) => `<div class="explain-row">
            <span class="explain-row__factor">${item.factor}</span>
            <span class="explain-row__impact" style="color:${getRiskColor(state.aiPanel.riskScore)}">${item.impact}</span>
          </div>`
        )
        .join("");
    }
  }

  function render() {
    renderRouteCards();
    drawRoutes(false);  // fitSelection = false → fit ALL routes on initial load
    renderAiPanel();
  }

  function saveLastAnalysis(source, destination, mode, payload) {
    saveJson(STORAGE_KEYS.lastAnalysis, {
      source,
      destination,
      mode,
      recommendedRouteId: payload.frontend?.recommendedRouteId || null,
      recommendedRouteName: payload.frontend?.recommendedRouteName || null,
      timestamp: Date.now(),
    });
  }

  async function selectRoute(routeId, fromUser = false) {
    const route = state.routes.find((item) => item.id === routeId);
    if (!route) return;

    state.selectedRouteId = routeId;

    // Build per-route AI panel data from the selected route's fields
    const explanationFactors = Array.isArray(route.explanation?.factors)
      ? route.explanation.factors
      : Array.isArray(route.riskFactors)
      ? route.riskFactors.map((f) => ({ factor: f, impact: route.riskScore >= 75 ? "High impact" : "Watch" }))
      : [];

    state.aiPanel = {
      ...state.aiPanel,
      selectedRouteId: route.id,
      riskScore: route.riskScore || 0,
      riskLevel: route.riskLevel || getRiskLabel(route.riskScore || 0),
      confidence: state.aiPanel?.confidence || 80,
      factors: {
        Weather: route.weather || 0,
        Traffic: route.congestion || 0,
        Vulnerability: route.routeVulnerability || 0,
        Reliability: Math.max(0, 100 - (route.riskScore || 0)),
      },
      recommendation: state.aiPanel?.recommendation || {
        headline: `Viewing ${route.routeName || route.name || route.label || route.id}`,
        body: `Risk score: ${route.riskScore || 0}. ${route.weatherCondition || ""} conditions, ${route.trafficLevel || ""} traffic.`,
      },
      explanations: explanationFactors,
    };

    // Re-render cards + AI panel, and re-draw map highlighting new selection
    renderRouteCards();
    drawRoutes(true);   // fitSelection = true → pan to selected route
    renderAiPanel();

    if (fromUser) {
      saveHistory(route);
      addAlertsForRoute(route);
      const displayName = route.routeName || route.name || route.label || route.id;
      if ((route.riskScore || 0) >= 75) {
        showAlert(`Warning: ${displayName} currently has elevated disruption risk.`, "danger");
      } else {
        hideAlert();
      }
    }
  }

  function applyAnalysisResult(source, destination, mode, payload) {
    const frontend = payload.frontend || {};
    state.routes = frontend.routeCards || [];
    state.recommendedRouteId = frontend.recommendedRouteId || null;
    state.fastestRouteId = frontend.fastestRouteId || null;
    state.selectedRouteId = frontend.recommendedRouteId || state.routes[0]?.id || null;
    state.aiPanel = frontend.aiPanel || null;

    if (refs.statusLabel) {
      refs.statusLabel.textContent = frontend.liveMode === false ? "Fallback Mode" : "Live Feed Active";
    }

    render();
    saveLastAnalysis(source, destination, mode, payload);
    const selected = state.routes.find((route) => route.id === state.selectedRouteId);
    if (selected) {
      saveHistory(selected);
      addAlertsForRoute(selected);
      const displayName = selected.routeName || selected.name || selected.label || selected.id;
      showAlert(
        `${frontend.recommendedRouteName || displayName} recommended. Estimated delay avoided: ${frontend.delayAvoided || "0 mins"}.`,
        selected.riskScore >= 75 ? "warning" : "info"
      );
    }
  }

  async function analyzeRoute(event) {
    event?.preventDefault();
    if (state.loading) return;

    const source = refs.source?.value.trim();
    const destination = refs.destination?.value.trim();
    const mode = refs.mode?.value || "driving";
    if (!source || !destination) {
      showAlert("Enter both origin and destination to analyze emergency routes.", "warning");
      return;
    }

    state.loading = true;
    if (refs.analyzeBtn) {
      refs.analyzeBtn.disabled = true;
      refs.analyzeBtn.textContent = "Analyzing…";
    }
    if (refs.routeCards) {
      refs.routeCards.innerHTML = '<div class="skeleton-card"><div class="skeleton skeleton-line skeleton-line--title"></div><div class="skeleton skeleton-line skeleton-line--medium"></div><div class="skeleton skeleton-bar"></div></div>';
    }

    try {
      const payload = await window.SentinelAPI.analyzeRoute(source, destination, mode);
      applyAnalysisResult(source, destination, mode, payload);
    } catch (error) {
      console.error("[SCL] analyzeRoute failed:", error);
      showAlert(error.message || "Route analysis failed.", "danger");
    } finally {
      state.loading = false;
      if (refs.analyzeBtn) {
        refs.analyzeBtn.disabled = false;
        refs.analyzeBtn.textContent = "Analyze Route";
      }
    }
  }

  async function boot() {
    initMap();
    updateAlertBadge();

    const live = await window.SentinelAPI.health().catch(() => false);
    if (refs.statusLabel) refs.statusLabel.textContent = live ? "Live Feed Active" : "Fallback Mode";

    const config = await window.SentinelAPI.fetchConfig().catch(() => null);
    if (refs.mode && config?.modes?.length) {
      refs.mode.innerHTML = config.modes
        .map((item) => `<option value="${item.value}">${item.label}</option>`)
        .join("");
    }

    refs.form?.addEventListener("submit", analyzeRoute);
    refs.demoPresets?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-demo-route]");
      if (!button) return;
      const preset = DEMO_ROUTES[button.dataset.demoRoute];
      if (!preset) return;

      if (refs.source) refs.source.value = preset.source;
      if (refs.destination) refs.destination.value = preset.destination;
      if (refs.mode) refs.mode.value = preset.mode;
      showAlert(`Loaded demo case: ${preset.label}.`, "info");
      analyzeRoute();
    });
    refs.alertClose?.addEventListener("click", hideAlert);
    refs.recAcceptBtn?.addEventListener("click", () => {
      const route = state.routes.find((item) => item.id === state.selectedRouteId);
      if (!route) return;
      const displayName = route.routeName || route.name || route.label || route.id;
      showAlert(`Route accepted: ${displayName}. Dispatch team can proceed.`, "info");
    });

    refs.sidebarAlerts?.addEventListener("click", (event) => {
      event.preventDefault();
      openAlerts();
    });
    refs.sidebarHistory?.addEventListener("click", (event) => {
      event.preventDefault();
      openHistory();
    });
    refs.sidebarSettings?.addEventListener("click", (event) => {
      event.preventDefault();
      openSettings();
    });

    refs.mapZoomIn?.addEventListener("click", () => state.map?.zoomIn());
    refs.mapZoomOut?.addEventListener("click", () => state.map?.zoomOut());
    refs.mapReset?.addEventListener("click", () => {
      if (state.routes.length) drawRoutes(false);
      else if (state.map) state.map.setView([20.5937, 78.9629], 5);
    });

    // Layer toggle: switch between standard OSM and dark CartoDB tiles
    let useAltTiles = false;
    let currentTileLayer = null;
    const layerToggleBtn = document.getElementById("map-layer-toggle");
    layerToggleBtn?.addEventListener("click", () => {
      if (!state.map) return;
      useAltTiles = !useAltTiles;
      if (currentTileLayer) {
        state.map.removeLayer(currentTileLayer);
      }
      if (useAltTiles) {
        currentTileLayer = window.L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
          { attribution: "&copy; OpenStreetMap &copy; CartoDB", maxZoom: 19 }
        ).addTo(state.map);
        layerToggleBtn.title = "Switch to standard map";
        layerToggleBtn.textContent = "🗺";
      } else {
        currentTileLayer = window.L.tileLayer(
          "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
          { attribution: "&copy; OpenStreetMap contributors", maxZoom: 18 }
        ).addTo(state.map);
        layerToggleBtn.title = "Switch to dark map";
        layerToggleBtn.textContent = "⬡";
      }
      // Re-draw routes on top of new tile layer
      if (state.routes.length) drawRoutes(false);
    });

    refs.aiToggle?.addEventListener("click", () => {
      refs.aiPanel?.classList.toggle("is-open");
      // Leaflet needs to recalculate its container size after the panel opens/closes
      setTimeout(() => { try { state.map?.invalidateSize(); } catch (_) {} }, 350);
    });
    refs.aiClose?.addEventListener("click", () => {
      refs.aiPanel?.classList.remove("is-open");
      setTimeout(() => { try { state.map?.invalidateSize(); } catch (_) {} }, 350);
    });

    if (refs.hamburger && refs.sidebar) {
      refs.hamburger.addEventListener("click", () => {
        const open = refs.sidebar.classList.toggle("is-open");
        refs.hamburger.setAttribute("aria-expanded", String(open));
      });
    }

    const cached = loadJson(STORAGE_KEYS.lastAnalysis, null);
    if (cached?.source && cached?.destination) {
      if (refs.source) refs.source.value = cached.source;
      if (refs.destination) refs.destination.value = cached.destination;
      if (refs.mode && cached.mode) refs.mode.value = cached.mode;
      analyzeRoute();
      return;
    }

    if (refs.source) refs.source.value = "Mumbai";
    if (refs.destination) refs.destination.value = "Pune";
    analyzeRoute();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
