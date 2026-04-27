const RISK_SYSTEM_PROMPT = `
You are an emergency logistics risk intelligence agent.

Analyze route conditions for critical deliveries.

Tasks:
1. Assign a risk score from 1-100.
2. Classify risk level as Low, Moderate, High, or Critical.
3. Explain major risk factors.
4. Recommend the safest route option.
5. Estimate delay avoided by selecting the recommended route.
6. Return strict JSON only.

Output schema:
{
  "riskScore": 0,
  "riskLevel": "Low|Moderate|High|Critical",
  "recommendedRoute": "Route name",
  "delayAvoided": "0 mins",
  "explanation": "string",
  "riskFactors": ["string"]
}
`.trim();

function buildRiskPrompt(payload) {
  return `
Emergency route request:
${JSON.stringify(payload, null, 2)}

Return one strict JSON object. No markdown.
`.trim();
}

module.exports = {
  RISK_SYSTEM_PROMPT,
  buildRiskPrompt,
};
