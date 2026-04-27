const { runSentinelAgents } = require("../../../ai-layer/src");

function mapTrafficLevel(level) {
  if (level === "Severe") return "Severe";
  if (level === "High") return "High";
  if (level === "Moderate") return "Moderate";
  return "Low";
}

function mapWeatherCondition(weatherData) {
  return weatherData?.primaryCondition || "Unknown";
}

function buildAgentPayload({ source, destination, routes, weatherDataList, trafficDataList, simulationScenario }) {
  const mappedRoutes = routes.map((route, idx) => ({
    name: route.name,
    etaMinutes: Math.round(route.durationSeconds / 60),
    reliabilityScore: Math.max(10, 100 - (route.distanceMeters > 60000 ? 35 : 15)),
    traffic: {
      congestion: mapTrafficLevel(trafficDataList[idx]?.trafficLevel),
      delayMinutes: trafficDataList[idx]?.delayMinutes ?? 0,
    },
    weather: {
      condition: mapWeatherCondition(weatherDataList[idx]),
      windSpeed: weatherDataList[idx]?.samples?.[0]?.windSpeed ?? 8,
      temperature: weatherDataList[idx]?.temperature ?? 28,
    },
  }));

  return {
    source,
    destination,
    routes: mappedRoutes,
    simulationScenario:
      simulationScenario === "traffic_accident" ? "accident" : simulationScenario || "none",
    enableVision: false,
  };
}

async function runAiPipeline(input) {
  const payload = buildAgentPayload(input);
  return runSentinelAgents(payload);
}

module.exports = {
  runAiPipeline,
  buildAgentPayload,
};
