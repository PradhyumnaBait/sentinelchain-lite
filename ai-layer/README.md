# SentinelChain Lite AI Layer

Agentic risk intelligence module for emergency routing.

## Implemented Agents

- `riskAgent`: analyzes weather + traffic + route reliability risk
- `rerouteAgent`: chooses safer route and provides tradeoff
- `explainAgent`: generates human-readable operational explanation
- `simulationAgent`: runs what-if scenario multipliers (flood/storm/accident)

## Structure

```text
src/
  agents/
  prompts/
  tools/
  services/
  vision/
  index.js
```

## Output Contract

The orchestrator returns:

- `riskScore`
- `riskLevel`
- `recommendedRoute`
- `delayAvoided`
- `explanation`

plus route-level analysis and metadata.

## Environment Variables

- `GEMINI_API_KEY` (required for live Gemini calls)
- `GEMINI_MODEL` (optional, default `gemini-1.5-flash`)
- `VERTEX_PROJECT_ID` (optional)
- `VERTEX_LOCATION` (optional)
- `VERTEX_AGENT_BUILDER_APP_ID` (optional)

Without `GEMINI_API_KEY`, the module uses deterministic fallback logic.
