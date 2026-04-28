/**
 * services/mapsService.js
 * Module 1 — Route Service
 *
 * Fetches route alternatives from Google Directions API and normalises
 * the response into a clean, frontend-ready structure.
 * Falls back to realistic mock data when the API key is absent or
 * USE_MOCK_DATA=true.
 */

const axios = require("axios");
const config = require("../config/apiKeys");

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Decode a Google polyline encoded string into an array of {lat, lng} objects.
 * Reference: https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
function decodePolyline(encoded) {
  const points = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;
}

/**
 * Parse traffic impact from the Google step duration_in_traffic vs duration.
 * Returns a label: "Low" | "Moderate" | "High" | "Severe"
 */
function parseTrafficImpact(route) {
  try {
    const leg = route.legs[0];
    const normalDuration = leg.duration.value; // seconds
    const trafficDuration = leg.duration_in_traffic
      ? leg.duration_in_traffic.value
      : normalDuration;
    const ratio = trafficDuration / normalDuration;

    if (ratio < 1.1) return "Low";
    if (ratio < 1.3) return "Moderate";
    if (ratio < 1.6) return "High";
    return "Severe";
  } catch {
    return "Unknown";
  }
}

/**
 * Derive simple risk factors from route warnings, summaries, and via waypoints.
 */
function extractRouteRiskFactors(route) {
  const factors = [];
  const summary = (route.summary || "").toLowerCase();
  const warnings = route.warnings || [];

  if (summary.includes("highway") || summary.includes("expressway")) {
    factors.push("High-speed highway corridor");
  }
  if (summary.includes("bridge") || summary.includes("flyover")) {
    factors.push("Bridge / flyover — flood-vulnerable");
  }
  if (warnings.length > 0) {
    warnings.forEach((w) => factors.push(w));
  }
  if (route.legs && route.legs[0] && route.legs[0].distance.value > 80000) {
    factors.push("Long-distance route — higher exposure window");
  }

  return factors.length ? factors : ["No specific structural risk factors identified"];
}

/**
 * Normalise a single Google Directions route object into our clean schema.
 */
function normaliseRoute(route, index) {
  const leg = route.legs[0];

  return {
    id: `route_${String.fromCharCode(65 + index)}`, // route_A, route_B …
    name: `Route ${String.fromCharCode(65 + index)}`,
    summary: route.summary || `Route ${String.fromCharCode(65 + index)}`,
    distance: leg.distance.text,
    distanceMeters: leg.distance.value,
    duration: leg.duration.text,
    durationSeconds: leg.duration.value,
    durationInTraffic: leg.duration_in_traffic
      ? leg.duration_in_traffic.text
      : leg.duration.text,
    trafficImpact: parseTrafficImpact(route),
    startAddress: leg.start_address,
    endAddress: leg.end_address,
    startLocation: leg.start_location,
    endLocation: leg.end_location,
    polyline: decodePolyline(route.overview_polyline.points),
    encodedPolyline: route.overview_polyline.points,
    warnings: route.warnings || [],
    riskFactors: extractRouteRiskFactors(route),
    steps: leg.steps.map((step) => ({
      instruction: step.html_instructions.replace(/<[^>]*>/g, ""), // strip HTML
      distance: step.distance.text,
      duration: step.duration.text,
      maneuver: step.maneuver || null,
    })),
  };
}

// ── Mock Data ─────────────────────────────────────────────────────────────────

function getMockRoutes(source, destination) {
  return [
    {
      id: "route_A",
      name: "Route A",
      summary: `${source} → Highway NH48 → ${destination}`,
      distance: "24.3 km",
      distanceMeters: 24300,
      duration: "42 mins",
      durationSeconds: 2520,
      durationInTraffic: "58 mins",
      trafficImpact: "High",
      startAddress: source,
      endAddress: destination,
      startLocation: { lat: 19.076, lng: 72.8777 },
      endLocation: { lat: 18.5204, lng: 73.8567 },
      polyline: [
        { lat: 19.076, lng: 72.8777 },
        { lat: 18.9967, lng: 73.1301 },
        { lat: 18.7853, lng: 73.3614 },
        { lat: 18.5204, lng: 73.8567 },
      ],
      encodedPolyline: "mock_encoded_polyline_A",
      warnings: ["Route contains toll roads"],
      riskFactors: [
        "High-speed highway corridor",
        "Known flood-prone zone near Khopoli",
        "Heavy truck traffic increases accident risk",
      ],
      steps: [
        { instruction: "Head south on NH48", distance: "8 km", duration: "12 mins", maneuver: "straight" },
        { instruction: "Take the Khopoli exit", distance: "6 km", duration: "10 mins", maneuver: "turn-right" },
        { instruction: "Continue towards destination", distance: "10.3 km", duration: "20 mins", maneuver: "straight" },
      ],
    },
    {
      id: "route_B",
      name: "Route B",
      summary: `${source} → Old Mumbai-Pune Road → ${destination}`,
      distance: "29.1 km",
      distanceMeters: 29100,
      duration: "52 mins",
      durationSeconds: 3120,
      durationInTraffic: "55 mins",
      trafficImpact: "Low",
      startAddress: source,
      endAddress: destination,
      startLocation: { lat: 19.076, lng: 72.8777 },
      endLocation: { lat: 18.5204, lng: 73.8567 },
      polyline: [
        { lat: 19.076, lng: 72.8777 },
        { lat: 18.9500, lng: 73.0500 },
        { lat: 18.7200, lng: 73.5000 },
        { lat: 18.5204, lng: 73.8567 },
      ],
      encodedPolyline: "mock_encoded_polyline_B",
      warnings: [],
      riskFactors: ["Mountainous terrain — landslide risk in heavy rain"],
      steps: [
        { instruction: "Head east on Old NH4", distance: "10 km", duration: "18 mins", maneuver: "straight" },
        { instruction: "Take the scenic mountain route", distance: "12 km", duration: "22 mins", maneuver: "turn-left" },
        { instruction: "Descend to destination", distance: "7.1 km", duration: "12 mins", maneuver: "straight" },
      ],
    },
  ];
}

// ── Main Service ──────────────────────────────────────────────────────────────

/**
 * Fetch route alternatives between source and destination.
 * Returns an array of normalised route objects.
 */
async function getRoutes(source, destination, mode = "driving") {
  if (config.useMockData || !config.googleMapsKey) {
    console.log("[MapsService] Using mock route data");
    return getMockRoutes(source, destination);
  }

  try {
    const response = await axios.get(
      "https://maps.googleapis.com/maps/api/directions/json",
      {
        params: {
          origin: source,
          destination,
          mode,
          alternatives: true,
          departure_time: "now",
          traffic_model: "best_guess",
          key: config.googleMapsKey,
        },
        timeout: 10000,
      }
    );

    const data = response.data;

    if (data.status !== "OK") {
      console.warn(`[MapsService] Directions API returned ${data.status}; using mock route data`);
      return getMockRoutes(source, destination);
    }

    if (!data.routes || data.routes.length === 0) {
      console.warn("[MapsService] No routes found; using mock route data");
      return getMockRoutes(source, destination);
    }

    return data.routes.map((route, idx) => normaliseRoute(route, idx));
  } catch (err) {
    // Network/timeout error → graceful fallback
    console.warn("[MapsService] API unreachable, falling back to mock data:", err.message);
    return getMockRoutes(source, destination);
  }
}

/**
 * Extract a midpoint coordinate from a route for weather checking.
 */
function getMidpoint(route) {
  const poly = route.polyline;
  if (!poly || poly.length === 0) return null;
  return poly[Math.floor(poly.length / 2)];
}

module.exports = { getRoutes, getMidpoint };
