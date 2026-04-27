/**
 * Mock traffic tool for agentic function-calling flow.
 */

async function checkTraffic(route) {
  const congestion = route?.traffic?.congestion || "Moderate";
  const delayMinutes = route?.traffic?.delayMinutes ?? 8;

  const base =
    congestion === "Severe"
      ? 85
      : congestion === "High"
      ? 70
      : congestion === "Moderate"
      ? 45
      : 20;

  const trafficScore = Math.min(100, base + Math.floor(delayMinutes / 2));
  return {
    congestion,
    delayMinutes,
    trafficScore,
  };
}

function trafficFunctionDeclaration() {
  return {
    name: "checkTraffic",
    description: "Assess traffic congestion and delay for a route.",
    parameters: {
      type: "OBJECT",
      properties: {
        routeName: { type: "STRING" },
        congestion: { type: "STRING" },
      },
      required: ["routeName"],
    },
  };
}

module.exports = {
  checkTraffic,
  trafficFunctionDeclaration,
};
