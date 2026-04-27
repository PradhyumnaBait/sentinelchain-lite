const { callGemini } = require("../services/geminiService");

function buildFallbackExplanation(topRiskRoute, recommendation) {
  const factors = topRiskRoute.riskFactors?.length
    ? topRiskRoute.riskFactors.join(", ")
    : "weather and traffic volatility";
  return `Route ${topRiskRoute.routeName} is riskier due to ${factors}. Use ${recommendation.recommendedRoute} for more reliable emergency delivery continuity.`;
}

async function buildExplanation({ routeAnalyses, recommendation }) {
  const riskiest = [...routeAnalyses].sort((a, b) => b.riskScore - a.riskScore)[0];

  const prompt = `
Explain the emergency logistics routing decision in plain operational language.
Input:
${JSON.stringify({ routeAnalyses, recommendation }, null, 2)}

Return strict JSON:
{"explanation":"..."}
`.trim();

  const gemini = await callGemini({ userPrompt: prompt }).catch(() => null);
  if (gemini?.explanation) return gemini.explanation;

  return buildFallbackExplanation(riskiest, recommendation);
}

module.exports = {
  buildExplanation,
};
