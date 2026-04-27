/**
 * services/geminiService.js
 * AI Risk Reasoning Engine
 *
 * Sends structured risk payloads to Google Gemini and receives
 * explainable, structured route risk decisions.
 * Falls back to rule-based explanation when API key is absent.
 */

const axios = require("axios");
const config = require("../config/apiKeys");

// ── Prompt Builder ────────────────────────────────────────────────────────────

function buildGeminiPrompt(riskPayloads, source, destination) {
  const routeDescriptions = riskPayloads
    .map(
      (p) => `
Route: ${p.routeName} (${p.summary})
- Distance: ${p.distance}, ETA: ${p.durationInTraffic}
- Weather: ${p.weather.condition} — Risk Level: ${p.weather.riskLevel} (Score: ${p.weather.score}/100)
  Temperature: ${p.weather.temperature}°C
  Active Alerts: ${p.weather.alerts.length > 0 ? p.weather.alerts.join("; ") : "None"}
- Traffic: ${p.traffic.level} congestion — Delay: ${p.traffic.delayMinutes} mins (Score: ${p.traffic.score}/100)
  ${p.traffic.description}
- Route Vulnerability Score: ${p.routeVulnerabilityScore}/100
- Computed Risk Score: ${p.riskScore}/100 (${p.riskLevel})
- Risk Factors: ${p.riskFactors.join("; ")}
${p.isSimulated ? `- [SIMULATION ACTIVE: ${p.simulationScenario}] — ${p.simulationNote}` : ""}
`.trim()
    )
    .join("\n\n");

  return `
You are SentinelChain — an AI Risk Reasoning Engine for emergency logistics operations.

Mission: Analyse route risk for a critical delivery and provide a clear, actionable recommendation.

Delivery Route: ${source} → ${destination}

ROUTE DATA:
${routeDescriptions}

Your task:
1. Assess the disruption risk for each route
2. Identify the SAFEST and most RELIABLE route for emergency delivery
3. Explain WHY in plain, operational language (suitable for a field driver)
4. Quantify confidence in your recommendation

Respond ONLY with a valid JSON object in this EXACT format (no markdown, no extra text):
{
  "recommendation": "<Route Name>",
  "confidence": <number 0-100>,
  "primaryReason": "<one sentence — the single most important reason for your recommendation>",
  "routeAnalysis": [
    {
      "routeId": "<route id>",
      "routeName": "<Route Name>",
      "aiRiskScore": <number 0-100>,
      "aiRiskLevel": "<Minimal|Low|Moderate|High|Critical>",
      "explanation": "<2-3 sentence operational explanation for a driver>",
      "keyRisks": ["<risk 1>", "<risk 2>"],
      "isSafeForEmergencyDelivery": <true|false>
    }
  ],
  "operationalAdvice": "<2-3 sentences of actionable advice for the emergency logistics operator>",
  "estimatedDelayAvoided": "<X mins>",
  "analysisTimestamp": "<ISO timestamp>"
}
`.trim();
}

// ── Fallback Rule-Based Explanation ──────────────────────────────────────────

function buildFallbackAnalysis(riskPayloads, source, destination) {
  const sorted = [...riskPayloads].sort((a, b) => a.riskScore - b.riskScore);
  const safest = sorted[0];
  const riskiest = sorted[sorted.length - 1];

  const delayDiff = Math.abs(riskiest.traffic.delayMinutes - safest.traffic.delayMinutes);

  const routeAnalysis = riskPayloads.map((p) => ({
    routeId: p.routeId,
    routeName: p.routeName,
    aiRiskScore: p.riskScore,
    aiRiskLevel: p.riskLevel,
    explanation: generateRouteExplanation(p),
    keyRisks: p.riskFactors.slice(0, 3),
    isSafeForEmergencyDelivery: p.riskScore < 60,
  }));

  return {
    recommendation: safest.routeName,
    confidence: Math.round(100 - safest.riskScore * 0.6),
    primaryReason: `${safest.routeName} has the lowest computed risk score (${safest.riskScore}/100) with ${safest.weather.riskLevel} weather and ${safest.traffic.level} traffic conditions.`,
    routeAnalysis,
    operationalAdvice: generateOperationalAdvice(safest, riskPayloads),
    estimatedDelayAvoided: `${delayDiff} mins`,
    analysisTimestamp: new Date().toISOString(),
    source: "rule-based-fallback",
  };
}

function generateRouteExplanation(payload) {
  const parts = [];

  if (payload.weather.riskLevel === "Critical" || payload.weather.riskLevel === "High") {
    parts.push(`Active ${payload.weather.condition} poses serious delivery risk.`);
  }

  if (payload.traffic.level === "Severe" || payload.traffic.level === "High") {
    parts.push(`Heavy congestion adds ${payload.traffic.delayMinutes} minutes to ETA.`);
  }

  if (payload.riskScore >= 70) {
    parts.push("This route is NOT recommended for emergency deliveries in current conditions.");
  } else if (payload.riskScore >= 40) {
    parts.push("Proceed with caution; monitor conditions en route.");
  } else {
    parts.push("Conditions are acceptable for emergency delivery.");
  }

  return parts.join(" ");
}

function generateOperationalAdvice(safestRoute, allPayloads) {
  const highRiskRoutes = allPayloads.filter((p) => p.riskScore >= 70);
  const advice = [];

  if (safestRoute.weather.alerts && safestRoute.weather.alerts.length > 0) {
    advice.push(`Monitor active weather alerts: ${safestRoute.weather.alerts.join(", ")}.`);
  }

  if (highRiskRoutes.length === allPayloads.length) {
    advice.push("All routes carry elevated risk — consider delaying delivery if non-critical.");
  } else {
    advice.push(`Use ${safestRoute.routeName} for the highest delivery reliability.`);
  }

  advice.push("Keep local emergency contacts ready and report road conditions to dispatch.");

  return advice.join(" ");
}

// ── Main AI Service ───────────────────────────────────────────────────────────

/**
 * Analyze route risk payloads using Gemini AI.
 * Returns structured risk decisions with explanations.
 */
async function analyzeRiskWithGemini(riskPayloads, source, destination) {
  if (!config.geminiApiKey) {
    console.log("[GeminiService] No API key — using rule-based fallback analysis");
    return buildFallbackAnalysis(riskPayloads, source, destination);
  }

  const prompt = buildGeminiPrompt(riskPayloads, source, destination);

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${config.geminiApiKey}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2048,
          responseMimeType: "application/json",
        },
      },
      { timeout: 30000 }
    );

    const raw = response.data.candidates[0].content.parts[0].text;

    // Parse JSON — Gemini may wrap it in markdown code fences
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(cleaned);

    return { ...parsed, source: "gemini-ai" };
  } catch (err) {
    console.warn("[GeminiService] AI call failed, falling back to rule-based:", err.message);
    return buildFallbackAnalysis(riskPayloads, source, destination);
  }
}

module.exports = { analyzeRiskWithGemini };
