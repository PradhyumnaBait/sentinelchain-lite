/**
 * Gemini service wrapper with optional mock fallback.
 * Uses REST so this module stays lightweight.
 */

const { RISK_SYSTEM_PROMPT } = require("../prompts/riskPrompt");

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";
const GEMINI_BASE_URL =
  process.env.GEMINI_BASE_URL ||
  "https://generativelanguage.googleapis.com/v1beta/models";

function safeJsonParse(raw) {
  try {
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

async function callGemini({ userPrompt, tools = [] }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const url = `${GEMINI_BASE_URL}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const body = {
    systemInstruction: {
      parts: [{ text: RISK_SYSTEM_PROMPT }],
    },
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
      maxOutputTokens: 2048,
    },
  };

  if (tools.length > 0) {
    body.tools = [
      {
        functionDeclarations: tools,
      },
    ];
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Gemini API failed with status ${response.status}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;
  return safeJsonParse(text);
}

module.exports = {
  callGemini,
  safeJsonParse,
};
