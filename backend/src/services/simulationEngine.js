/**
 * services/simulationEngine.js
 * Module 5 — Simulation Engine
 *
 * Applies disaster scenario modifiers to risk factors and scoring inputs.
 * Supports: flood, storm, traffic_accident, normal (reset)
 *
 * The engine returns a simulation modifier object that the riskBuilder
 * uses to augment the final risk score and inject scenario context.
 */

// ── Scenario Definitions ──────────────────────────────────────────────────────

const SCENARIOS = {
  flood: {
    name: "Flood Simulation",
    description: "Severe flooding is affecting roads in the region",
    weatherOverride: {
      primaryCondition: "Heavy Flooding",
      weatherRisk: "Critical",
      weatherScore: 95,
      alerts: [
        "Flash flood warning issued by authorities",
        "Road submersion reported on low-lying routes",
        "Bridges at risk of closure",
      ],
      temperature: 22,
    },
    trafficMultiplier: 1.8,
    riskMultiplier: 1.6,
    additionalRiskFactors: [
      "Road submersion — impassable for standard vehicles",
      "Bridge structural risk elevated under flood conditions",
      "Emergency services diverted to flood rescue",
      "Visibility severely reduced",
    ],
    note: "Simulating active flood event — road submersion and bridge risk critical",
    icon: "🌊",
  },

  storm: {
    name: "Severe Storm Simulation",
    description: "A severe storm system is sweeping through the delivery corridor",
    weatherOverride: {
      primaryCondition: "Severe Thunderstorm",
      weatherRisk: "Critical",
      weatherScore: 92,
      alerts: [
        "Severe thunderstorm warning active",
        "Dangerous lightning activity along route corridor",
        "Gusty winds up to 80 km/h — risk of debris on road",
      ],
      temperature: 18,
    },
    trafficMultiplier: 1.5,
    riskMultiplier: 1.5,
    additionalRiskFactors: [
      "Dangerous lightning — avoid open road segments",
      "High-speed winds increasing accident risk for heavy vehicles",
      "Reduced visibility — headlights mandatory",
      "Flying debris reported on highway stretches",
    ],
    note: "Simulating severe storm — extreme weather disruption to all routes",
    icon: "⛈️",
  },

  traffic_accident: {
    name: "Major Accident Simulation",
    description: "A multi-vehicle accident has caused a full road closure",
    weatherOverride: null, // weather unchanged
    trafficMultiplier: 2.5,
    riskMultiplier: 1.35,
    additionalRiskFactors: [
      "Multi-vehicle accident — full lane closure reported",
      "Emergency services on scene — expect 60+ min delays",
      "Rubbernecking congestion on parallel routes",
      "Diversion routes severely overloaded",
    ],
    note: "Simulating major road accident — primary route blocked, expect severe traffic impact",
    icon: "🚨",
  },

  normal: {
    name: "Normal Conditions",
    description: "No active simulation — showing real-time conditions",
    weatherOverride: null,
    trafficMultiplier: 1.0,
    riskMultiplier: 1.0,
    additionalRiskFactors: [],
    note: null,
    icon: "✅",
  },
};

// ── Severity Amplification ────────────────────────────────────────────────────

const SEVERITY_MULTIPLIERS = {
  low: 0.7,
  medium: 1.0,
  high: 1.3,
  critical: 1.6,
};

// ── Main Engine ───────────────────────────────────────────────────────────────

/**
 * Apply simulation to weather data for a route.
 */
function applyWeatherSimulation(weatherData, scenario) {
  if (!scenario.weatherOverride) return weatherData;

  return {
    ...weatherData,
    ...scenario.weatherOverride,
    samples: weatherData.samples, // preserve sample points
  };
}

/**
 * Apply simulation to traffic data for a route.
 */
function applyTrafficSimulation(trafficData, scenario) {
  const multiplied = Math.min(100, Math.round(trafficData.trafficScore * scenario.trafficMultiplier));
  const newDelay = Math.round(trafficData.delayMinutes * scenario.trafficMultiplier);

  const getLevel = (score) => {
    if (score >= 80) return "Severe";
    if (score >= 55) return "High";
    if (score >= 30) return "Moderate";
    return "Low";
  };

  return {
    ...trafficData,
    trafficScore: multiplied,
    trafficLevel: getLevel(multiplied),
    delayMinutes: newDelay,
    description: `[SIMULATED] ${scenario.description}. ${trafficData.description}`,
  };
}

/**
 * Apply a simulation to all route data.
 *
 * @param {string}   scenarioKey - "flood" | "storm" | "traffic_accident" | "normal"
 * @param {string}   severity    - "low" | "medium" | "high" | "critical"
 * @param {Object[]} routes
 * @param {Object[]} weatherDataList
 * @param {Object[]} trafficDataList
 * @returns {{ routes, weatherDataList, trafficDataList, simulation, scenarioMeta }}
 */
function applySimulation(
  scenarioKey,
  severity = "high",
  routes,
  weatherDataList,
  trafficDataList
) {
  const scenario = SCENARIOS[scenarioKey];
  if (!scenario) {
    const err = new Error(`Unknown simulation scenario: ${scenarioKey}`);
    err.statusCode = 400;
    err.code = "INVALID_SCENARIO";
    throw err;
  }

  const severityMultiplier = SEVERITY_MULTIPLIERS[severity] || 1.0;
  const effectiveScenario = {
    ...scenario,
    trafficMultiplier: 1 + (scenario.trafficMultiplier - 1) * severityMultiplier,
    riskMultiplier: 1 + (scenario.riskMultiplier - 1) * severityMultiplier,
  };

  const simulatedWeather = weatherDataList.map((w) =>
    applyWeatherSimulation(w, effectiveScenario)
  );
  const simulatedTraffic = trafficDataList.map((t) =>
    applyTrafficSimulation(t, effectiveScenario)
  );

  // Inject additional risk factors into routes
  const simulatedRoutes = routes.map((r) => ({
    ...r,
    riskFactors: [
      ...effectiveScenario.additionalRiskFactors,
      ...r.riskFactors,
    ],
  }));

  return {
    routes: simulatedRoutes,
    weatherDataList: simulatedWeather,
    trafficDataList: simulatedTraffic,
    simulation: {
      scenario: scenarioKey,
      severity,
      multiplier: effectiveScenario.riskMultiplier,
      note: effectiveScenario.note,
    },
    scenarioMeta: {
      name: scenario.name,
      description: scenario.description,
      icon: scenario.icon,
      severity,
    },
  };
}

/**
 * Return available scenario definitions (for frontend UI).
 */
function getAvailableScenarios() {
  return Object.entries(SCENARIOS).map(([key, s]) => ({
    key,
    name: s.name,
    description: s.description,
    icon: s.icon,
  }));
}

module.exports = { applySimulation, getAvailableScenarios, SCENARIOS };
