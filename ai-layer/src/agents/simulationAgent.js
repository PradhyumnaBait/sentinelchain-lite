const SCENARIO_MULTIPLIERS = {
  none: 1,
  flood: 1.35,
  storm: 1.25,
  accident: 1.2,
};

function runScenarioSimulation(routeAnalyses, scenario = "none") {
  const key = String(scenario || "none").toLowerCase();
  const multiplier = SCENARIO_MULTIPLIERS[key] || 1;

  return routeAnalyses.map((route) => {
    const score = Math.min(100, Math.round(route.riskScore * multiplier));
    const riskLevel = score >= 80 ? "Critical" : score >= 60 ? "High" : score >= 35 ? "Moderate" : "Low";

    return {
      ...route,
      riskScore: score,
      riskLevel,
      simulation: {
        scenario: key,
        multiplier,
      },
    };
  });
}

module.exports = {
  runScenarioSimulation,
};
