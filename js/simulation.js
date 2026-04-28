(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const STORAGE_KEY = "scl-last-analysis";
  const SEVERITY_MAP = [
    { max: 25, label: "low" },
    { max: 50, label: "medium" },
    { max: 75, label: "high" },
    { max: 100, label: "critical" },
  ];

  const refs = {
    sidebar: $("sidebar"),
    hamburger: $("hamburger-btn"),
    scenarioSelect: $("scenario-select"),
    severitySlider: $("severity-slider"),
    severityValue: $("severity-val"),
    durationSelect: $("duration-select"),
    regionInput: $("region-input"),
    runButton: $("run-simulation-btn"),
    resetButton: $("reset-simulation-btn"),
    gaugeFill: $("gauge-fill"),
    gaugeScore: $("gauge-score"),
    gaugeBadge: $("gauge-badge"),
    impactDelay: $("impact-delay-val"),
    impactCost: $("impact-cost-val"),
    impactRisk: $("impact-risk-val"),
    impactAlt: $("impact-alt-val"),
    impactNote: $("impact-note"),
    timeline: $("risk-timeline"),
    chartBars: Array.from(document.querySelectorAll(".chart-bar")),
    sidebarAlerts: $("sidebar-alerts"),
    sidebarHistory: $("sidebar-history"),
    sidebarSettings: $("sidebar-settings"),
    statusLabel: document.querySelector(".status-label"),
  };

  const FALLBACK_SCENARIOS = [
    { key: "flood", name: "Flood Simulation" },
    { key: "storm", name: "Severe Storm Simulation" },
    { key: "traffic_accident", name: "Major Accident Simulation" },
    { key: "normal", name: "Normal Conditions" },
  ];

  function loadLastAnalysis() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    } catch (_) {
      return null;
    }
  }

  function riskClass(score) {
    if (score >= 75) return "high";
    if (score >= 45) return "medium";
    return "low";
  }

  function riskLabel(score) {
    if (score >= 75) return "High Risk";
    if (score >= 45) return "Medium Risk";
    return "Low Risk";
  }

  function riskColor(score) {
    if (score >= 75) return "var(--clr-risk-high)";
    if (score >= 45) return "var(--clr-risk-medium)";
    return "var(--clr-risk-safe)";
  }

  function sliderToSeverity(value) {
    const numeric = Number(value || 50);
    return SEVERITY_MAP.find((item) => numeric <= item.max)?.label || "high";
  }

  function generateProfile(peak, count) {
    return Array.from({ length: count }, (_, index) => {
      const distance = Math.abs(index - Math.floor(count * 0.35));
      return Math.max(12, Math.round(peak - distance * 6));
    });
  }

  function renderTimeline(items) {
    if (!refs.timeline) return;
    refs.timeline.innerHTML = (items || [])
      .map(
        (item, index) => `<li class="timeline-event timeline-event--${item.level}" id="timeline-ev-${index + 1}">
          <span class="timeline-event__dot" aria-hidden="true"></span>
          <div class="timeline-event__content">
            <p class="timeline-event__label">Step ${index + 1} — ${item.label}</p>
            <p class="timeline-event__desc">${item.desc}</p>
          </div>
          <span class="risk-badge risk-badge--${item.level === "danger" ? "high" : item.level === "warn" ? "medium" : "low"}">${item.level === "danger" ? "High" : item.level === "warn" ? "Medium" : "Low"}</span>
        </li>`
      )
      .join("");
  }

  function renderResult(result) {
    const score = result.adjustedRisk;
    if (refs.gaugeFill) refs.gaugeFill.style.width = `${score}%`;
    if (refs.gaugeScore) {
      refs.gaugeScore.textContent = String(score);
      refs.gaugeScore.style.color = riskColor(score);
    }
    if (refs.gaugeBadge) {
      refs.gaugeBadge.className = `risk-badge risk-badge--${riskClass(score)}`;
      refs.gaugeBadge.textContent = riskLabel(score);
    }
    if (refs.impactDelay) refs.impactDelay.textContent = result.delay;
    if (refs.impactCost) refs.impactCost.textContent = result.cost;
    if (refs.impactRisk) {
      refs.impactRisk.textContent = result.delta;
      refs.impactRisk.style.color = riskColor(score);
    }
    if (refs.impactAlt) refs.impactAlt.textContent = result.alt;
    if (refs.impactNote) refs.impactNote.textContent = result.note;

    (result.riskProfile || []).forEach((value, index) => {
      const bar = refs.chartBars[index];
      if (!bar) return;
      const maxVal = Math.max(...(result.riskProfile || []), 1);
      const pct = (value / maxVal) * 100;
      bar.style.height = `${pct}%`;
      bar.style.minHeight = "4px"; // Ensure even zero values are visible
      bar.className = `chart-bar${value >= 75 ? " chart-bar--peak" : ""}`;
      bar.title = `Step ${index + 1}: ${value}% risk`;
    });

    renderTimeline(result.timeline);
  }

  function setRunning(loading) {
    if (!refs.runButton) return;
    refs.runButton.disabled = loading;
    refs.runButton.textContent = loading ? "Simulating disruption impact…" : "Run Simulation";
  }

  function showModal(title, body) {
    document.querySelector(".notify-modal-overlay")?.remove();
    const overlay = document.createElement("div");
    overlay.className = "notify-modal-overlay";
    overlay.innerHTML = `<div class="notify-modal">
      <p class="notify-modal__title">${title}</p>
      <div class="notify-modal__body">${body}</div>
      <div class="notify-modal__footer"><button class="btn btn--primary btn--sm" id="notify-close">Close</button></div>
    </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("#notify-close")?.addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) overlay.remove();
    });
  }

  async function populateScenarios() {
    const scenarios = await window.SentinelAPI.fetchScenarios();
    if (!refs.scenarioSelect) return;
    const available = scenarios && scenarios.length ? scenarios : FALLBACK_SCENARIOS;

    refs.scenarioSelect.innerHTML =
      '<option value="">— Select Scenario —</option>' +
      available
        .map(
          (scenario) =>
            `<option value="${scenario.key}">${scenario.name}</option>`
        )
        .join("");
  }

  function buildSimulationView(data, source, destination, scenarioLabel) {
    // Handle both direct backend response (data.frontend) and wrapped response
    const frontend = data.frontend || data || {};
    const aiPanel = frontend.aiPanel || {};
    const riskScore = aiPanel.riskScore || data.riskScore || 50;
    const baseline = 35;

    return {
      adjustedRisk: riskScore,
      delay: frontend.delayAvoided || data.delayAvoided || "0 mins",
      cost: `+${Math.max(5, Math.round(riskScore * 0.22))}%`,
      delta: `▲ +${Math.max(0, riskScore - baseline)} pts`,
      alt: frontend.recommendedRouteName || data.recommendedRouteName || "N/A",
      note:
        aiPanel.recommendation?.body ||
        `${scenarioLabel} changes the safer route from ${source} to ${destination}.`,
      riskProfile: generateProfile(riskScore, refs.chartBars.length || 14),
      timeline: [
        {
          label: `${scenarioLabel} activated`,
          desc: `${scenarioLabel} conditions are being applied to the route corridor.`,
          level: "danger",
        },
        {
          label: "Risk engine recalculated",
          desc: `${frontend.recommendedRouteName || data.recommendedRouteName || "Alternate route"} is now the safest path under simulated disruption.`,
          level: riskScore >= 75 ? "danger" : "warn",
        },
        {
          label: "Operator guidance",
          desc: aiPanel.recommendation?.headline || "Use the recommended alternate route.",
          level: "safe",
        },
      ],
    };
  }

  async function runSimulation() {
    const cached = loadLastAnalysis();
    if (!cached?.source || !cached?.destination) {
      showModal("Route Required", "Analyze a route on the dashboard first, then return here to simulate disruptions.");
      return;
    }

    const scenario = refs.scenarioSelect?.value;
    if (!scenario) {
      showModal("Scenario Required", "Select a disruption scenario before running the simulation.");
      return;
    }

    const severity = sliderToSeverity(refs.severitySlider?.value);
    const scenarioLabel = refs.scenarioSelect.options[refs.scenarioSelect.selectedIndex]?.text || scenario;
    setRunning(true);

    try {
      const data = await window.SentinelAPI.runSimulation(
        cached.source,
        cached.destination,
        scenario,
        severity,
        cached.mode || "driving"
      );
      const view = buildSimulationView(data, cached.source, cached.destination, scenarioLabel);
      renderResult(view);
    } catch (error) {
      console.error("[SCL] Simulation failed:", error);
      showModal("Simulation Failed", error.message || "Unable to run simulation right now.");
    } finally {
      setRunning(false);
    }
  }

  function resetSimulation() {
    renderResult({
      adjustedRisk: 42,
      delay: "+0 mins",
      cost: "+0%",
      delta: "+0 pts",
      alt: "Analyze a route first",
      note: "Run a simulation to see scenario-driven risk changes.",
      riskProfile: generateProfile(42, refs.chartBars.length || 14),
      timeline: [],
    });
    if (refs.scenarioSelect) refs.scenarioSelect.value = "";
    if (refs.severitySlider) refs.severitySlider.value = "50";
    if (refs.severityValue) refs.severityValue.textContent = "50";
  }

  function bindSidebar() {
    if (refs.hamburger && refs.sidebar) {
      refs.hamburger.addEventListener("click", () => {
        const open = refs.sidebar.classList.toggle("is-open");
        refs.hamburger.setAttribute("aria-expanded", String(open));
      });
    }

    refs.sidebarAlerts?.addEventListener("click", (event) => {
      event.preventDefault();
      showModal("Alerts", "Live alerts are generated on the dashboard after route analysis.");
    });
    refs.sidebarHistory?.addEventListener("click", (event) => {
      event.preventDefault();
      const cached = loadLastAnalysis();
      showModal(
        "Last Route Context",
        cached
          ? `${cached.source} → ${cached.destination}<br>Recommended route: ${cached.recommendedRouteName || "N/A"}`
          : "No dashboard analysis is cached yet."
      );
    });
    refs.sidebarSettings?.addEventListener("click", (event) => {
      event.preventDefault();
      showModal("Simulation Settings", "Severity and scenario options are synced from the backend.");
    });
  }

  async function boot() {
    if (refs.severitySlider && refs.severityValue) {
      refs.severitySlider.addEventListener("input", () => {
        refs.severityValue.textContent = refs.severitySlider.value;
      });
    }

    refs.runButton?.addEventListener("click", runSimulation);
    refs.resetButton?.addEventListener("click", resetSimulation);

    bindSidebar();
    await populateScenarios();

    const live = await window.SentinelAPI.health().catch(() => false);
    if (refs.statusLabel) refs.statusLabel.textContent = live ? "Live Feed Active" : "Fallback Mode";

    const cached = loadLastAnalysis();
    if (cached?.source && refs.regionInput) {
      refs.regionInput.value = `${cached.source} → ${cached.destination}`;
    }

    resetSimulation();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
