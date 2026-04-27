/**
 * Mock weather tool for function-calling flow.
 * Replace with live weather provider integration.
 */

async function checkWeather(route) {
  const baseline = route?.weather?.condition || "Clear";
  const rainFactor = /rain|storm|flood/i.test(baseline) ? 30 : 5;
  const windFactor = route?.weather?.windSpeed && route.weather.windSpeed > 20 ? 20 : 5;

  const weatherScore = Math.min(100, rainFactor + windFactor + 15);
  const weatherRisk =
    weatherScore >= 80 ? "Critical" : weatherScore >= 60 ? "High" : weatherScore >= 35 ? "Moderate" : "Low";

  return {
    condition: baseline,
    temperature: route?.weather?.temperature ?? 28,
    windSpeed: route?.weather?.windSpeed ?? 8,
    weatherScore,
    weatherRisk,
  };
}

function weatherFunctionDeclaration() {
  return {
    name: "checkWeather",
    description: "Assess route weather severity for emergency logistics risk.",
    parameters: {
      type: "OBJECT",
      properties: {
        routeName: { type: "STRING" },
        condition: { type: "STRING" },
      },
      required: ["routeName"],
    },
  };
}

module.exports = {
  checkWeather,
  weatherFunctionDeclaration,
};
