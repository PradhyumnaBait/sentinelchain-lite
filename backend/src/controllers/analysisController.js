/**
 * controllers/analysisController.js
 * Handles:
 *   POST /api/analyze-route   — Full pipeline: routes + weather + traffic + AI
 *   POST /api/weather         — Weather risk only
 *   POST /api/traffic         — Traffic risk only
 *   GET  /api/scenarios       — List available simulation scenarios
 */

const mapsService = require("../services/mapsService");
const weatherService = require("../services/weatherService");
const trafficService = require("../services/trafficService");
const riskBuilder = require("../services/riskBuilder");
const geminiService = require("../services/geminiService");
const { runAiPipeline } = require("../services/aiOrchestratorService");
const { buildFrontendAnalysisView } = require("../services/frontendAdapterService");

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/analyze-route
// Full pipeline: routes → weather → traffic → risk build → AI analysis
// ─────────────────────────────────────────────────────────────────────────────

const analyzeRoute = async (req, res, next) => {
  try {
    const { source, destination, mode = "driving" } = req.body;

    console.log(`[AnalysisController] Full analysis: "${source}" → "${destination}"`);
    const startTime = Date.now();

    // Step 1: Fetch routes
    const routes = await mapsService.getRoutes(source, destination, mode);

    // Step 2: Fetch weather for all routes in parallel
    const weatherDataList = await Promise.all(
      routes.map(async (route) => {
        const origin = route.startLocation;
        const destination = route.endLocation;
        const midpoint = mapsService.getMidpoint(route);
        return weatherService.getRouteWeatherRisk(origin, midpoint, destination);
      })
    );

    // Step 3: Fetch traffic for all routes in parallel
    const trafficDataList = await trafficService.getTrafficRisksForRoutes(routes);

    // Step 4: Build risk payloads
    const { payloads, recommendedRouteId, recommendedRouteName, delayAvoided, riskSummary } =
      riskBuilder.buildAllRiskPayloads(routes, weatherDataList, trafficDataList);

    // Step 5: Legacy Gemini analysis + new AI-layer orchestrator analysis
    const [aiAnalysis, agenticAi] = await Promise.all([
      geminiService.analyzeRiskWithGemini(payloads, source, destination),
      runAiPipeline({
        source,
        destination,
        routes,
        weatherDataList,
        trafficDataList,
        simulationScenario: req.body.simulationScenario || "none",
      }),
    ]);

    const processingTime = Date.now() - startTime;
    const frontend = buildFrontendAnalysisView({
      routes,
      riskPayloads: payloads,
      recommendedRouteId,
      recommendedRouteName,
      delayAvoided,
      aiAnalysis,
      agenticAi,
    });

    return res.status(200).json({
      success: true,
      data: {
        source,
        destination,
        mode,
        routes,
        riskPayloads: payloads,
        riskSummary,
        recommendedRouteId,
        recommendedRouteName,
        delayAvoided,
        aiAnalysis,
        agenticAi,
        frontend,
        processingTimeMs: processingTime,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    return next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/weather
// Returns weather risk for a source-to-destination pair (samples 3 points)
// ─────────────────────────────────────────────────────────────────────────────

const getWeatherRisk = async (req, res, next) => {
  try {
    const { source, destination } = req.body;

    console.log(`[AnalysisController] Weather risk: "${source}" → "${destination}"`);

    // Rough coordinate lookup via routes
    const routes = await mapsService.getRoutes(source, destination);
    const route = routes[0];

    const weatherData = await weatherService.getRouteWeatherRisk(
      route.startLocation,
      mapsService.getMidpoint(route),
      route.endLocation
    );

    return res.status(200).json({
      success: true,
      data: {
        source,
        destination,
        ...weatherData,
      },
    });
  } catch (err) {
    return next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/traffic
// Returns traffic risk for a source-to-destination pair (first route)
// ─────────────────────────────────────────────────────────────────────────────

const getTrafficRisk = async (req, res, next) => {
  try {
    const { source, destination } = req.body;

    console.log(`[AnalysisController] Traffic risk: "${source}" → "${destination}"`);

    const routes = await mapsService.getRoutes(source, destination);
    const trafficDataList = await trafficService.getTrafficRisksForRoutes(routes);

    const results = routes.map((r, idx) => ({
      routeId: r.id,
      routeName: r.name,
      summary: r.summary,
      ...trafficDataList[idx],
    }));

    return res.status(200).json({
      success: true,
      data: {
        source,
        destination,
        routes: results,
      },
    });
  } catch (err) {
    return next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/scenarios
// Returns available simulation scenario options
// ─────────────────────────────────────────────────────────────────────────────

const { getAvailableScenarios } = require("../services/simulationEngine");

const listScenarios = (_req, res) => {
  return res.status(200).json({
    success: true,
    data: {
      scenarios: getAvailableScenarios(),
    },
  });
};

module.exports = { analyzeRoute, getWeatherRisk, getTrafficRisk, listScenarios };
