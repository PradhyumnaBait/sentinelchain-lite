/**
 * services/trafficService.js
 * Module 3 — Traffic Risk Service
 *
 * Derives traffic risk from Google Directions data (duration_in_traffic
 * vs. normal duration) or falls back to mock data.
 * Also exposes a standalone POST /api/traffic endpoint payload builder.
 */

const axios = require("axios");
const config = require("../config/apiKeys");

// ── Risk Scoring ──────────────────────────────────────────────────────────────

/**
 * Convert the duration-to-traffic-duration ratio into a structured risk object.
 * Scale: 0–100 risk score mapped to four qualitative levels.
 */
function computeTrafficRisk(normalSeconds, trafficSeconds) {
  const ratio = trafficSeconds / normalSeconds;
  const delayMinutes = Math.round((trafficSeconds - normalSeconds) / 60);

  let level, score, description;

  if (ratio < 1.1) {
    level = "Low";
    score = Math.round(ratio * 15); // 0–15
    description = "Traffic is flowing freely";
  } else if (ratio < 1.3) {
    level = "Moderate";
    score = Math.round(30 + (ratio - 1.1) * 100); // 30–50
    description = "Mild congestion — minor delays expected";
  } else if (ratio < 1.6) {
    level = "High";
    score = Math.round(55 + (ratio - 1.3) * 100); // 55–79
    description = "Heavy congestion — significant delays";
  } else {
    level = "Severe";
    score = Math.min(100, Math.round(80 + (ratio - 1.6) * 50)); // 80–100
    description = "Standstill traffic — major incident or congestion collapse";
  }

  return {
    trafficLevel: level,
    trafficScore: score,
    congestionRatio: Math.round(ratio * 100) / 100,
    delayMinutes,
    description,
  };
}

function parseDurationTextToSeconds(durationText) {
  if (!durationText || typeof durationText !== "string") return null;
  const normalized = durationText.toLowerCase().trim();

  const hourMatch = normalized.match(/(\d+)\s*hour/);
  const minuteMatch = normalized.match(/(\d+)\s*min/);

  const hours = hourMatch ? Number.parseInt(hourMatch[1], 10) : 0;
  const minutes = minuteMatch ? Number.parseInt(minuteMatch[1], 10) : 0;

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  const total = hours * 3600 + minutes * 60;
  return total > 0 ? total : null;
}

// ── Mock Data ─────────────────────────────────────────────────────────────────

function getMockTrafficRisk(routeId) {
  const scenarios = {
    route_A: {
      trafficLevel: "High",
      trafficScore: 75,
      congestionRatio: 1.48,
      delayMinutes: 16,
      description: "Heavy congestion on NH48 — major accident reported",
    },
    route_B: {
      trafficLevel: "Low",
      trafficScore: 18,
      congestionRatio: 1.06,
      delayMinutes: 3,
      description: "Traffic flowing freely on alternate route",
    },
  };

  return (
    scenarios[routeId] || {
      trafficLevel: "Moderate",
      trafficScore: 45,
      congestionRatio: 1.22,
      delayMinutes: 8,
      description: "Moderate congestion — allow extra buffer time",
    }
  );
}

// ── Main Service ──────────────────────────────────────────────────────────────

/**
 * Extract traffic risk from an already-fetched normalised route object.
 * We derive the ratio from durationSeconds vs. durationInTrafficSeconds if
 * available; otherwise we call Google Distance Matrix for real-time data.
 */
async function getTrafficRiskForRoute(route) {
  if (config.useMockData || !config.googleMapsKey) {
    console.log(`[TrafficService] Using mock traffic data for ${route.id}`);
    return getMockTrafficRisk(route.id);
  }

  try {
    // If we already have duration_in_traffic from Directions API, use it.
    if (route.durationSeconds && route.durationInTraffic) {
      const parsedTrafficSeconds = parseDurationTextToSeconds(route.durationInTraffic);
      const trafficSeconds = parsedTrafficSeconds || route.durationSeconds;
      return computeTrafficRisk(route.durationSeconds, trafficSeconds);
    }

    // Fallback: Distance Matrix API
    const response = await axios.get(
      "https://maps.googleapis.com/maps/api/distancematrix/json",
      {
        params: {
          origins: `${route.startLocation.lat},${route.startLocation.lng}`,
          destinations: `${route.endLocation.lat},${route.endLocation.lng}`,
          departure_time: "now",
          traffic_model: "best_guess",
          key: config.googleMapsKey,
        },
        timeout: 8000,
      }
    );

    const element = response.data.rows[0].elements[0];
    if (element.status !== "OK") throw new Error("Distance Matrix element status: " + element.status);

    const normal = element.duration.value;
    const withTraffic = element.duration_in_traffic
      ? element.duration_in_traffic.value
      : normal;

    return computeTrafficRisk(normal, withTraffic);
  } catch (err) {
    console.warn(`[TrafficService] Falling back to mock for ${route.id}:`, err.message);
    return getMockTrafficRisk(route.id);
  }
}

/**
 * Get traffic risks for multiple routes in parallel.
 */
async function getTrafficRisksForRoutes(routes) {
  return Promise.all(routes.map((r) => getTrafficRiskForRoute(r)));
}

module.exports = { getTrafficRisksForRoutes, getTrafficRiskForRoute, computeTrafficRisk };
