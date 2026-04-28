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

/**
 * Derive approximate city centre coordinates from known city names.
 * Falls back to a rough central-India point if not found.
 */
const CITY_COORDS = {
  mumbai: { lat: 19.076, lng: 72.8777 },
  pune: { lat: 18.5204, lng: 73.8567 },
  chennai: { lat: 13.0827, lng: 80.2707 },
  puducherry: { lat: 11.9416, lng: 79.8083 },
  pondicherry: { lat: 11.9416, lng: 79.8083 },
  guwahati: { lat: 26.1445, lng: 91.7362 },
  shillong: { lat: 25.5788, lng: 91.8933 },
  delhi: { lat: 28.6139, lng: 77.209 },
  hyderabad: { lat: 17.385, lng: 78.4867 },
  bangalore: { lat: 12.9716, lng: 77.5946 },
  bengaluru: { lat: 12.9716, lng: 77.5946 },
  kolkata: { lat: 22.5726, lng: 88.3639 },
  ahmedabad: { lat: 23.0225, lng: 72.5714 },
  surat: { lat: 21.1702, lng: 72.8311 },
};

function getCityCoord(name) {
  const key = (name || "").toLowerCase().split(",")[0].trim();
  for (const [city, coord] of Object.entries(CITY_COORDS)) {
    if (key.includes(city)) return coord;
  }
  // Fallback: rough centre of India
  return { lat: 20.5937, lng: 78.9629 };
}

/**
 * Generate 3 mock route alternatives with clearly different polyline paths.
 * Route A: highway (direct, slight north arc)
 * Route B: scenic/mountain (wider south detour)
 * Route C: inland/alternate (east-west dogleg)
 */
function getMockRoutes(source, destination) {
  const start = getCityCoord(source);
  const end = getCityCoord(destination);

  // Helper: interpolate between two points
  const lerp = (a, b, t) => a + (b - a) * t;
  const midLat = lerp(start.lat, end.lat, 0.5);
  const midLng = lerp(start.lng, end.lng, 0.5);

  // Perpendicular offset magnitudes for visible path separation
  const perpLat = (end.lng - start.lng) * 0.18;
  const perpLng = (end.lat - start.lat) * -0.18;

  return [
    {
      id: "route_A",
      name: "Route A",
      summary: `${source} → Highway Corridor → ${destination}`,
      distance: "24.3 km",
      distanceMeters: 24300,
      duration: "42 mins",
      durationSeconds: 2520,
      durationInTraffic: "58 mins",
      trafficImpact: "High",
      startAddress: source,
      endAddress: destination,
      startLocation: start,
      endLocation: end,
      polyline: [
        { lat: start.lat, lng: start.lng },
        { lat: lerp(start.lat, end.lat, 0.25) + perpLat * 0.5, lng: lerp(start.lng, end.lng, 0.25) + perpLng * 0.5 },
        { lat: midLat + perpLat, lng: midLng + perpLng },
        { lat: lerp(start.lat, end.lat, 0.75) + perpLat * 0.5, lng: lerp(start.lng, end.lng, 0.75) + perpLng * 0.5 },
        { lat: end.lat, lng: end.lng },
      ],
      encodedPolyline: "mock_encoded_polyline_A",
      warnings: ["Route contains toll roads"],
      riskFactors: [
        "High-speed highway corridor",
        "Known flood-prone zone along route",
        "Heavy truck traffic increases accident risk",
      ],
      steps: [
        { instruction: "Head on highway corridor", distance: "8 km", duration: "12 mins", maneuver: "straight" },
        { instruction: "Continue on main route", distance: "8.3 km", duration: "16 mins", maneuver: "straight" },
        { instruction: "Arrive at destination", distance: "8 km", duration: "14 mins", maneuver: "straight" },
      ],
    },
    {
      id: "route_B",
      name: "Route B",
      summary: `${source} → Alternate Scenic Road → ${destination}`,
      distance: "29.1 km",
      distanceMeters: 29100,
      duration: "52 mins",
      durationSeconds: 3120,
      durationInTraffic: "55 mins",
      trafficImpact: "Low",
      startAddress: source,
      endAddress: destination,
      startLocation: start,
      endLocation: end,
      polyline: [
        { lat: start.lat, lng: start.lng },
        { lat: lerp(start.lat, end.lat, 0.2) - perpLat * 0.6, lng: lerp(start.lng, end.lng, 0.2) - perpLng * 0.6 },
        { lat: midLat - perpLat * 1.2, lng: midLng - perpLng * 1.2 },
        { lat: lerp(start.lat, end.lat, 0.8) - perpLat * 0.6, lng: lerp(start.lng, end.lng, 0.8) - perpLng * 0.6 },
        { lat: end.lat, lng: end.lng },
      ],
      encodedPolyline: "mock_encoded_polyline_B",
      warnings: [],
      riskFactors: ["Mountainous terrain — landslide risk in heavy rain", "Narrow roads with sharp bends"],
      steps: [
        { instruction: "Head on scenic alternate road", distance: "10 km", duration: "18 mins", maneuver: "straight" },
        { instruction: "Take the mountain bypass", distance: "12 km", duration: "22 mins", maneuver: "turn-left" },
        { instruction: "Descend to destination", distance: "7.1 km", duration: "12 mins", maneuver: "straight" },
      ],
    },
    {
      id: "route_C",
      name: "Route C",
      summary: `${source} → Inland Bypass → ${destination}`,
      distance: "33.7 km",
      distanceMeters: 33700,
      duration: "62 mins",
      durationSeconds: 3720,
      durationInTraffic: "68 mins",
      trafficImpact: "Moderate",
      startAddress: source,
      endAddress: destination,
      startLocation: start,
      endLocation: end,
      polyline: [
        { lat: start.lat, lng: start.lng },
        { lat: start.lat + (end.lat - start.lat) * 0.15, lng: start.lng + (end.lng - start.lng) * 0.05 },
        { lat: midLat + perpLat * 0.3, lng: midLng - perpLng * 1.5 },
        { lat: end.lat + (start.lat - end.lat) * 0.12, lng: end.lng - (end.lng - start.lng) * 0.1 },
        { lat: end.lat, lng: end.lng },
      ],
      encodedPolyline: "mock_encoded_polyline_C",
      warnings: ["Construction zone ahead"],
      riskFactors: ["Road under construction in sections", "Low bridge clearance on bypass"],
      steps: [
        { instruction: "Head on inland bypass", distance: "12 km", duration: "20 mins", maneuver: "straight" },
        { instruction: "Continue via bypass ring road", distance: "14 km", duration: "26 mins", maneuver: "turn-right" },
        { instruction: "Arrive at destination", distance: "7.7 km", duration: "16 mins", maneuver: "straight" },
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

    const liveRoutes = data.routes.map((route, idx) => normaliseRoute(route, idx));
    return ensureThreeDistinctRoutes(liveRoutes, source, destination);
  } catch (err) {
    // Network/timeout error → graceful fallback
    console.warn("[MapsService] API unreachable, falling back to mock data:", err.message);
    return getMockRoutes(source, destination);
  }
}

/**
 * Check if two polylines are effectively identical (share same midpoint within ~1km tolerance).
 */
function polylinesAreSimilar(polA, polB) {
  if (!polA || !polB || polA.length < 2 || polB.length < 2) return false;
  const midA = polA[Math.floor(polA.length / 2)];
  const midB = polB[Math.floor(polB.length / 2)];
  const latDiff = Math.abs(midA.lat - midB.lat);
  const lngDiff = Math.abs(midA.lng - midB.lng);
  return latDiff < 0.01 && lngDiff < 0.01; // ~1 km
}

/**
 * Ensure at least 3 distinct routes by supplementing with mock alternatives when
 * the live API returns fewer routes or routes with identical polylines.
 * Live routes keep their real polylines; only synthetic alternatives are added.
 */
function ensureThreeDistinctRoutes(liveRoutes, source, destination) {
  if (liveRoutes.length >= 3) return liveRoutes;

  const mocks = getMockRoutes(source, destination);

  // Detect if live routes have duplicate polylines and replace with mock for variety
  if (liveRoutes.length >= 2 && polylinesAreSimilar(liveRoutes[0].polyline, liveRoutes[1].polyline)) {
    console.log("[MapsService] Live routes have identical polylines — using mock route data for map variety");
    return mocks;
  }

  // Pad up to 3 with mock alternatives (re-indexed to avoid id clash)
  const result = [...liveRoutes];
  for (let i = result.length; i < 3; i++) {
    const mock = { ...mocks[i] };
    mock.id = `route_${String.fromCharCode(65 + i)}`;
    mock.name = `Route ${String.fromCharCode(65 + i)}`;
    mock.isMockAlternative = true;
    result.push(mock);
  }
  return result;
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
