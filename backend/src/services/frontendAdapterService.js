function toUiRiskLevel(level) {
  const normalized = String(level || "").toLowerCase();
  if (normalized === "critical" || normalized === "high" || normalized === "severe") return "high";
  if (normalized === "moderate" || normalized === "medium") return "medium";
  return "low";
}

function pickRecommendedExplanation(payload, agenticAi, aiAnalysis) {
  const agenticRoute = agenticAi?.routeAnalyses?.find(
    (route) => route.routeName === payload.routeName
  );
  const legacyRoute = aiAnalysis?.routeAnalysis?.find(
    (route) => route.routeId === payload.routeId || route.routeName === payload.routeName
  );

  return {
    primary:
      legacyRoute?.explanation ||
      agenticAi?.explanation ||
      `Route risk is ${payload.riskLevel.toLowerCase()} due to current weather and traffic conditions.`,
    factors:
      payload.riskFactors?.slice(0, 4).map((factor) => ({
        factor,
        impact:
          payload.riskScore >= 75
            ? "High impact"
            : payload.riskScore >= 50
            ? "Watch closely"
            : "Manageable",
      })) || [],
    agenticFactors: agenticRoute?.riskFactors || [],
  };
}

function buildRouteCards({
  routes,
  riskPayloads,
  recommendedRouteId,
  recommendedRouteName,
  delayAvoided,
  agenticAi,
  aiAnalysis,
}) {
  const fastestRoute = [...routes].sort((a, b) => a.durationSeconds - b.durationSeconds)[0];

  return routes.map((route) => {
    const payload = riskPayloads.find((item) => item.routeId === route.id);
    const explanation = pickRecommendedExplanation(payload, agenticAi, aiAnalysis);
    const risk = toUiRiskLevel(payload?.riskLevel);

    return {
      id: route.id,
      label: route.name.toUpperCase(),
      name: route.summary || route.name,
      routeName: route.name,
      summary: route.summary,
      origin: route.startAddress,
      destination: route.endAddress,
      eta: Math.round(route.durationSeconds / 60),
      etaText: route.durationInTraffic || route.duration,
      distance: Math.round(route.distanceMeters / 1000),
      distanceText: route.distance,
      color: risk === "high" ? "#DC2626" : risk === "medium" ? "#D97706" : "#059669",
      coords: (route.polyline || []).map((point) => [point.lat, point.lng]),
      risk,
      riskScore: payload?.riskScore || 0,
      riskLevel: payload?.riskLevel || "Low",
      isRecommended: route.id === recommendedRouteId,
      isFastest: route.id === fastestRoute?.id,
      weather: payload?.weather?.score || 0,
      congestion: payload?.traffic?.score || 0,
      routeVulnerability: payload?.routeVulnerabilityScore || 0,
      weatherCondition: payload?.weather?.condition || "Unknown",
      trafficLevel: payload?.traffic?.level || "Low",
      delayMinutes: payload?.traffic?.delayMinutes || 0,
      riskFactors: payload?.riskFactors || [],
      explanation,
      delayAvoided: route.id === recommendedRouteId ? delayAvoided : null,
      tags: [
        route.id === recommendedRouteId ? "Safer route" : null,
        route.id === fastestRoute?.id ? "Fastest route" : null,
      ].filter(Boolean),
    };
  });
}

function buildAiPanel({
  routeCards,
  recommendedRouteName,
  recommendedRouteId,
  delayAvoided,
  aiAnalysis,
  agenticAi,
}) {
  const recommendedCard =
    routeCards.find((route) => route.id === recommendedRouteId) || routeCards[0];

  const factorValues = {
    Weather: recommendedCard.weather,
    Traffic: recommendedCard.congestion,
    Vulnerability: recommendedCard.routeVulnerability,
    Reliability: Math.max(0, 100 - recommendedCard.riskScore),
  };

  return {
    selectedRouteId: recommendedCard.id,
    riskScore: recommendedCard.riskScore,
    riskLevel: recommendedCard.riskLevel,
    confidence: aiAnalysis?.confidence || 82,
    factors: factorValues,
    recommendation: {
      headline:
        agenticAi?.recommendedRoute && delayAvoided
          ? `Use ${agenticAi.recommendedRoute} to avoid about ${delayAvoided}`
          : `Use ${recommendedRouteName} for safer delivery continuity`,
      body:
        agenticAi?.explanation ||
        aiAnalysis?.primaryReason ||
        recommendedCard.explanation.primary,
    },
    explanations:
      recommendedCard.explanation.factors.length > 0
        ? recommendedCard.explanation.factors
        : recommendedCard.riskFactors.map((factor) => ({
            factor,
            impact: "Operational risk",
          })),
    delayAvoided,
  };
}

function buildFrontendAnalysisView(input) {
  const routeCards = buildRouteCards(input);
  const aiPanel = buildAiPanel({ ...input, routeCards });

  return {
    routeCards,
    recommendedRouteId: input.recommendedRouteId,
    recommendedRouteName: input.recommendedRouteName,
    fastestRouteId: [...routeCards].sort((a, b) => a.eta - b.eta)[0]?.id || null,
    aiPanel,
    simulation: input.simulation || null,
    liveMode: true,
    delayAvoided: input.delayAvoided,
  };
}

module.exports = {
  buildFrontendAnalysisView,
};
