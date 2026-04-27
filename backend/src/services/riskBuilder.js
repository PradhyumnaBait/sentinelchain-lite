/**
 * services/riskBuilder.js
 * Module 4 — Risk Input Builder + Risk Score Engine
 *
 * Combines route metadata, weather data, and traffic data into:
 *   1. A structured payload ready for Gemini AI analysis
 *   2. A pre-computed weighted risk score (used as a fallback / cross-check)
 *
 * Weighted Risk Formula:
 *   Risk = (40% × trafficScore) + (40% × weatherScore) + (20% × routeVulnerability)
 */

// ── Route Vulnerability Scoring ───────────────────────────────────────────────

/**
 * Compute a route vulnerability score (0–100) from static route characteristics.
 * This represents the inherent risk of the route regardless of real-time conditions.
 */
function computeRouteVulnerability(route) {
  let score = 10; // baseline
  const summary = (route.summary || "").toLowerCase();
  const factors = route.riskFactors || [];

  // Distance penalty: longer = more exposure
  if (route.distanceMeters > 100000) score += 20;
  else if (route.distanceMeters > 50000) score += 10;
  else if (route.distanceMeters > 25000) score += 5;

  // Structural risk factors
  const dangerKeywords = [
    { keyword: "flood", points: 20 },
    { keyword: "bridge", points: 15 },
    { keyword: "flyover", points: 12 },
    { keyword: "landslide", points: 20 },
    { keyword: "highway", points: 8 },
    { keyword: "tunnel", points: 10 },
    { keyword: "coastal", points: 18 },
    { keyword: "mountain", points: 15 },
    { keyword: "low-lying", points: 18 },
  ];

  const combined = [summary, ...factors].join(" ").toLowerCase();
  for (const { keyword, points } of dangerKeywords) {
    if (combined.includes(keyword)) score += points;
  }

  // Warnings from Directions API
  score += (route.warnings || []).length * 8;

  return Math.min(100, score);
}

// ── Weighted Risk Score ───────────────────────────────────────────────────────

/**
 * Compute a final composite risk score for a route.
 *
 * @param {number} trafficScore   - 0–100 from trafficService
 * @param {number} weatherScore   - 0–100 from weatherService
 * @param {number} routeVulScore  - 0–100 from computeRouteVulnerability
 * @returns {{ score: number, breakdown: Object }}
 */
function computeWeightedRiskScore(trafficScore, weatherScore, routeVulScore) {
  const weighted =
    0.4 * trafficScore + 0.4 * weatherScore + 0.2 * routeVulScore;
  const score = Math.round(Math.min(100, weighted));

  return {
    score,
    breakdown: {
      traffic: { weight: "40%", score: trafficScore, contribution: Math.round(0.4 * trafficScore) },
      weather: { weight: "40%", score: weatherScore, contribution: Math.round(0.4 * weatherScore) },
      routeVulnerability: { weight: "20%", score: routeVulScore, contribution: Math.round(0.2 * routeVulScore) },
    },
  };
}

/**
 * Map a numeric risk score to a human-readable risk level.
 */
function scoreToLevel(score) {
  if (score >= 80) return "Critical";
  if (score >= 60) return "High";
  if (score >= 35) return "Moderate";
  if (score >= 15) return "Low";
  return "Minimal";
}

// ── Risk Factor Collector ─────────────────────────────────────────────────────

function collectRiskFactors(route, weatherData, trafficData) {
  const factors = [];

  // Weather-derived
  if (weatherData.weatherRisk === "Critical" || weatherData.weatherRisk === "High") {
    factors.push(`${weatherData.primaryCondition} — ${weatherData.weatherRisk} weather risk`);
  }
  if (weatherData.alerts && weatherData.alerts.length > 0) {
    factors.push(...weatherData.alerts);
  }
  if (weatherData.samples) {
    for (const sample of weatherData.samples) {
      if (sample.rainfall1h > 15) factors.push(`Extreme rainfall: ${sample.rainfall1h}mm/h recorded`);
      if (sample.windSpeed > 20) factors.push(`High wind speed: ${sample.windSpeed} m/s`);
    }
  }

  // Traffic-derived
  if (trafficData.trafficLevel === "Severe" || trafficData.trafficLevel === "High") {
    factors.push(`${trafficData.description} (delay: ${trafficData.delayMinutes} min)`);
  }

  // Route structural factors
  factors.push(...(route.riskFactors || []));

  // De-duplicate
  return [...new Set(factors)].filter(Boolean);
}

// ── Main Builder ──────────────────────────────────────────────────────────────

/**
 * Build the complete structured risk payload for a single route.
 * This object is sent to the Gemini AI service for deeper reasoning.
 *
 * @param {Object} route       - Normalised route from mapsService
 * @param {Object} weatherData - Aggregated from weatherService
 * @param {Object} trafficData - From trafficService
 * @param {Object} [simulation] - Optional simulation overrides
 * @returns {Object} Full risk payload
 */
function buildRiskPayload(route, weatherData, trafficData, simulation = null) {
  const routeVulScore = computeRouteVulnerability(route);
  const { score, breakdown } = computeWeightedRiskScore(
    trafficData.trafficScore,
    weatherData.weatherScore,
    routeVulScore
  );

  // Apply simulation multiplier if present
  let finalScore = score;
  let simulationNote = null;
  if (simulation) {
    finalScore = Math.min(100, Math.round(score * simulation.multiplier));
    simulationNote = simulation.note;
  }

  const level = scoreToLevel(finalScore);
  const riskFactors = collectRiskFactors(route, weatherData, trafficData);
  if (simulationNote) riskFactors.unshift(`[SIMULATION] ${simulationNote}`);

  return {
    routeId: route.id,
    routeName: route.name,
    summary: route.summary,
    distance: route.distance,
    duration: route.duration,
    durationInTraffic: route.durationInTraffic,

    // Real-time conditions
    weather: {
      condition: weatherData.primaryCondition,
      riskLevel: weatherData.weatherRisk,
      score: weatherData.weatherScore,
      temperature: weatherData.temperature,
      alerts: weatherData.alerts || [],
    },
    traffic: {
      level: trafficData.trafficLevel,
      score: trafficData.trafficScore,
      delayMinutes: trafficData.delayMinutes,
      description: trafficData.description,
    },

    // Computed risk
    routeVulnerabilityScore: routeVulScore,
    riskScore: finalScore,
    riskLevel: level,
    scoreBreakdown: breakdown,
    riskFactors,

    // Simulation context
    isSimulated: !!simulation,
    simulationScenario: simulation ? simulation.scenario : null,
    simulationNote,

    // Metadata
    timestamp: new Date().toISOString(),
  };
}

/**
 * Build payloads for all routes and determine the recommended route.
 *
 * @param {Object[]} routes
 * @param {Object[]} weatherDataList - one per route
 * @param {Object[]} trafficDataList - one per route
 * @param {Object}   [simulation]    - optional simulation modifier
 * @returns {{ payloads: Object[], recommendedRouteId: string }}
 */
function buildAllRiskPayloads(routes, weatherDataList, trafficDataList, simulation = null) {
  const payloads = routes.map((route, idx) =>
    buildRiskPayload(route, weatherDataList[idx], trafficDataList[idx], simulation)
  );

  // Recommend the route with the lowest risk score
  const recommended = payloads.reduce((best, curr) =>
    curr.riskScore < best.riskScore ? curr : best
  );

  // Compute delay avoided vs worst route
  const worst = payloads.reduce((w, curr) => (curr.riskScore > w.riskScore ? curr : w));
  const delayAvoided =
    worst.routeId !== recommended.routeId
      ? Math.abs(worst.traffic.delayMinutes - recommended.traffic.delayMinutes)
      : 0;

  return {
    payloads,
    recommendedRouteId: recommended.routeId,
    recommendedRouteName: recommended.routeName,
    delayAvoided: `${delayAvoided} mins`,
    riskSummary: {
      lowest: { id: recommended.routeId, score: recommended.riskScore, level: recommended.riskLevel },
      highest: { id: worst.routeId, score: worst.riskScore, level: worst.riskLevel },
    },
  };
}

module.exports = {
  buildRiskPayload,
  buildAllRiskPayloads,
  computeRouteVulnerability,
  computeWeightedRiskScore,
  scoreToLevel,
};
