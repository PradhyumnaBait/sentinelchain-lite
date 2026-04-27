const { callGemini } = require("../services/geminiService");
const { buildRiskPrompt } = require("../prompts/riskPrompt");
const { checkWeather, weatherFunctionDeclaration } = require("../tools/weatherTool");
const { checkTraffic, trafficFunctionDeclaration } = require("../tools/trafficTool");

function toRiskLevel(score) {
  if (score >= 80) return "Critical";
  if (score >= 60) return "High";
  if (score >= 35) return "Moderate";
  return "Low";
}

function normalizeRiskOutput(routeName, score, factors) {
  return {
    routeName,
    riskScore: score,
    riskLevel: toRiskLevel(score),
    riskFactors: factors,
  };
}

async function analyzeRouteRisk(route) {
  const weather = await checkWeather(route);
  const traffic = await checkTraffic(route);

  const deterministicScore = Math.min(
    100,
    Math.round(weather.weatherScore * 0.5 + traffic.trafficScore * 0.4 + (route?.reliabilityScore ? 100 - route.reliabilityScore : 40) * 0.1)
  );

  const promptPayload = {
    routeName: route.name,
    weather,
    traffic,
    reliabilityScore: route?.reliabilityScore ?? 60,
  };

  const gemini = await callGemini({
    userPrompt: buildRiskPrompt(promptPayload),
    tools: [weatherFunctionDeclaration(), trafficFunctionDeclaration()],
  }).catch(() => null);

  if (gemini && typeof gemini.riskScore === "number") {
    return normalizeRiskOutput(route.name, Math.max(1, Math.min(100, gemini.riskScore)), gemini.riskFactors || []);
  }

  const factors = [
    `${weather.condition} weather`,
    `${traffic.congestion} traffic with ~${traffic.delayMinutes} mins delay`,
    `Route reliability score ${route?.reliabilityScore ?? 60}`,
  ];

  return normalizeRiskOutput(route.name, deterministicScore, factors);
}

module.exports = {
  analyzeRouteRisk,
};
