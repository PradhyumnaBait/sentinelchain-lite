function pickSafestRoute(riskAnalyses) {
  const sorted = [...riskAnalyses].sort((a, b) => a.riskScore - b.riskScore);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  // Project disruption penalty from risk score and compare likely real-world ETAs.
  const penalty = (score) => Math.round((score / 100) * 35);
  const expectedWorstDelay = (worst.etaMinutes || 0) + penalty(worst.riskScore);
  const expectedBestDelay = (best.etaMinutes || 0) + penalty(best.riskScore);
  const delayAvoided = Math.max(0, expectedWorstDelay - expectedBestDelay);

  return {
    recommendedRoute: best.routeName,
    delayAvoided: `${delayAvoided} mins`,
    tradeoff: `${best.routeName} is safer than ${worst.routeName}, with lower disruption probability.`,
  };
}

module.exports = {
  pickSafestRoute,
};
