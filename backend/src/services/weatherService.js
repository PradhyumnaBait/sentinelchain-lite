/**
 * services/weatherService.js
 * Module 2 — Weather Risk Service
 *
 * Fetches current weather conditions from OpenWeatherMap for one or
 * more points along a route (origin, midpoint, destination) and
 * converts them into a structured risk assessment.
 * Falls back to mock data when the API key is absent.
 */

const axios = require("axios");
const config = require("../config/apiKeys");

// ── Risk Rule Engine ──────────────────────────────────────────────────────────

/**
 * Map OpenWeatherMap weather condition IDs to risk levels and descriptors.
 * Reference: https://openweathermap.org/weather-conditions
 */
function classifyWeatherCondition(weatherId, rain1h = 0, windSpeed = 0) {
  // Thunderstorm
  if (weatherId >= 200 && weatherId < 300) {
    return { level: "Critical", label: "Thunderstorm", score: 95 };
  }

  // Drizzle
  if (weatherId >= 300 && weatherId < 400) {
    return { level: "Low", label: "Drizzle", score: 20 };
  }

  // Rain
  if (weatherId >= 500 && weatherId < 600) {
    if (weatherId === 502 || weatherId === 503 || weatherId === 504) {
      return { level: "Critical", label: "Heavy / Extreme Rain", score: 90 };
    }
    if (weatherId === 501) {
      return { level: "High", label: "Moderate Rain", score: 65 };
    }
    if (rain1h > 10) {
      return { level: "High", label: "Heavy Rainfall", score: 75 };
    }
    return { level: "Moderate", label: "Light Rain", score: 40 };
  }

  // Snow
  if (weatherId >= 600 && weatherId < 700) {
    if (weatherId >= 621) return { level: "High", label: "Heavy Snow / Shower", score: 70 };
    return { level: "Moderate", label: "Snow", score: 50 };
  }

  // Atmosphere (fog, haze, dust storm…)
  if (weatherId >= 700 && weatherId < 800) {
    if (weatherId === 781) return { level: "Critical", label: "Tornado", score: 100 };
    if (weatherId === 762) return { level: "High", label: "Volcanic Ash", score: 80 };
    if (weatherId === 751 || weatherId === 761) return { level: "High", label: "Sand/Dust Storm", score: 72 };
    if (weatherId === 741) return { level: "Moderate", label: "Dense Fog", score: 55 };
    return { level: "Low", label: "Atmospheric Haze", score: 20 };
  }

  // Clear / Clouds
  if (weatherId === 800) {
    if (windSpeed > 20) return { level: "Moderate", label: "Clear but Windy", score: 30 };
    return { level: "None", label: "Clear Sky", score: 5 };
  }

  if (weatherId >= 801 && weatherId < 900) {
    if (windSpeed > 25) return { level: "Moderate", label: "Cloudy + High Winds", score: 35 };
    return { level: "None", label: "Mostly Cloudy", score: 10 };
  }

  return { level: "Unknown", label: "Unknown Conditions", score: 0 };
}

/**
 * Aggregate weather risk across multiple sample points.
 * Returns the worst-case risk.
 */
function aggregateWeatherRisk(samples) {
  const order = ["None", "Low", "Moderate", "High", "Critical", "Unknown"];
  let worst = samples[0];

  for (const s of samples) {
    if (order.indexOf(s.riskLevel) > order.indexOf(worst.riskLevel)) {
      worst = s;
    }
  }

  const avgTemp =
    samples.reduce((sum, s) => sum + s.temperature, 0) / samples.length;

  return {
    weatherRisk: worst.riskLevel,
    weatherScore: worst.riskScore,
    primaryCondition: worst.condition,
    temperature: Math.round(avgTemp),
    samples,
    alerts: worst.alerts || [],
  };
}

// ── Mock Data ─────────────────────────────────────────────────────────────────

function getMockWeather(lat, lng) {
  // Simulate varied conditions based on rough location
  const seed = (lat * 100 + lng * 10) % 4;
  const scenarios = [
    {
      condition: "Heavy Rain",
      riskLevel: "High",
      riskScore: 72,
      temperature: 24,
      humidity: 90,
      windSpeed: 14,
      rainfall1h: 12,
      alerts: ["Flood watch in effect"],
    },
    {
      condition: "Clear Sky",
      riskLevel: "None",
      riskScore: 5,
      temperature: 31,
      humidity: 45,
      windSpeed: 6,
      rainfall1h: 0,
      alerts: [],
    },
    {
      condition: "Thunderstorm",
      riskLevel: "Critical",
      riskScore: 95,
      temperature: 20,
      humidity: 95,
      windSpeed: 28,
      rainfall1h: 25,
      alerts: ["Severe thunderstorm warning", "Flash flood warning"],
    },
    {
      condition: "Moderate Rain",
      riskLevel: "Moderate",
      riskScore: 45,
      temperature: 22,
      humidity: 80,
      windSpeed: 10,
      rainfall1h: 5,
      alerts: [],
    },
  ];
  return { lat, lng, ...scenarios[Math.abs(Math.floor(seed)) % 4] };
}

// ── Live API Fetch ────────────────────────────────────────────────────────────

async function fetchWeatherForPoint(lat, lng) {
  if (config.useMockData || !config.weatherApiKey) {
    return getMockWeather(lat, lng);
  }

  try {
    const response = await axios.get(
      "https://api.openweathermap.org/data/2.5/weather",
      {
        params: {
          lat,
          lon: lng,
          appid: config.weatherApiKey,
          units: "metric",
        },
        timeout: 8000,
      }
    );

    const d = response.data;
    const weatherMain = d.weather[0];
    const rain1h = d.rain ? d.rain["1h"] || 0 : 0;
    const windSpeed = d.wind ? d.wind.speed : 0;
    const classification = classifyWeatherCondition(weatherMain.id, rain1h, windSpeed);

    return {
      lat,
      lng,
      condition: weatherMain.description,
      riskLevel: classification.level,
      riskScore: classification.score,
      temperature: Math.round(d.main.temp),
      humidity: d.main.humidity,
      windSpeed,
      rainfall1h: rain1h,
      alerts: [],
    };
  } catch (err) {
    console.warn(`[WeatherService] Failed to fetch weather at (${lat},${lng}):`, err.message);
    return getMockWeather(lat, lng);
  }
}

// ── Main Service ──────────────────────────────────────────────────────────────

/**
 * Get weather risk for a route by sampling origin, midpoint, and destination.
 *
 * @param {Object} origin      - { lat, lng }
 * @param {Object} midpoint    - { lat, lng } (can be null)
 * @param {Object} destination - { lat, lng }
 * @returns {Object} Aggregated weather risk object
 */
async function getRouteWeatherRisk(origin, midpoint, destination) {
  const checkPoints = [origin, destination];
  if (midpoint) checkPoints.splice(1, 0, midpoint);

  const samples = await Promise.all(
    checkPoints.map((pt) => fetchWeatherForPoint(pt.lat, pt.lng))
  );

  return aggregateWeatherRisk(samples);
}

module.exports = { getRouteWeatherRisk, classifyWeatherCondition };
