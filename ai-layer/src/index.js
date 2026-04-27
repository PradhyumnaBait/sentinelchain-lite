const { analyzeRouteRisk } = require("./agents/riskAgent");
const { pickSafestRoute } = require("./agents/rerouteAgent");
const { buildExplanation } = require("./agents/explainAgent");
const { runScenarioSimulation } = require("./agents/simulationAgent");
const { attachVertexMetadata } = require("./services/vertexService");
const { detectRoadHazardsFromImage } = require("./vision/hazardDetection");

/**
 * SentinelChain Lite AI Orchestrator
 * Input format:
 * {
 *   source: "Hospital A",
 *   destination: "Relief Camp B",
 *   routes: [{ name, etaMinutes, traffic, weather, reliabilityScore }],
 *   simulationScenario: "none|flood|storm|accident",
 *   enableVision: false
 * }
 */
async function runSentinelAgents(payload) {
  const routes = Array.isArray(payload?.routes) ? payload.routes : [];
  if (routes.length === 0) {
    throw new Error("At least one route is required.");
  }

  const initialAnalyses = await Promise.all(
    routes.map(async (route) => {
      const risk = await analyzeRouteRisk(route);
      return {
        ...risk,
        etaMinutes: route.etaMinutes ?? 0,
      };
    })
  );

  const routeAnalyses =
    payload?.simulationScenario && payload.simulationScenario !== "none"
      ? runScenarioSimulation(initialAnalyses, payload.simulationScenario)
      : initialAnalyses;

  const recommendation = pickSafestRoute(routeAnalyses);
  const explanation = await buildExplanation({ routeAnalyses, recommendation });

  let vision = null;
  if (payload?.enableVision) {
    vision = await detectRoadHazardsFromImage(payload?.hazardImagePath);
  }

  const topRisk = [...routeAnalyses].sort((a, b) => b.riskScore - a.riskScore)[0];

  const response = {
    riskScore: topRisk.riskScore,
    riskLevel: topRisk.riskLevel,
    recommendedRoute: recommendation.recommendedRoute,
    delayAvoided: recommendation.delayAvoided,
    explanation,
    routeAnalyses,
    simulationScenario: payload?.simulationScenario || "none",
    vision,
    timestamp: new Date().toISOString(),
  };

  return attachVertexMetadata(response, "final-decision");
}

module.exports = {
  runSentinelAgents,
};
