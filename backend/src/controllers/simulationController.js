/**
 * controllers/simulationController.js
 * Handles: POST /api/simulate
 *
 * Runs a full route analysis pipeline with a simulation scenario applied.
 * Returns risk-augmented payloads plus AI analysis showing the "what-if".
 */

const mapsService = require("../services/mapsService");
const weatherService = require("../services/weatherService");
const trafficService = require("../services/trafficService");
const riskBuilder = require("../services/riskBuilder");
const geminiService = require("../services/geminiService");
const simulationEngine = require("../services/simulationEngine");
const { runAiPipeline } = require("../services/aiOrchestratorService");
const { buildFrontendAnalysisView } = require("../services/frontendAdapterService");

/**
 * POST /api/simulate
 * Body: { source, destination, scenario, severity? }
 */
const runSimulation = async (req, res, next) => {
  try {
    const {
      source,
      destination,
      scenario,
      severity = "high",
      mode = "driving",
    } = req.body;

    const normalizedScenario =
      scenario === "accident"
        ? "traffic_accident"
        : scenario === "none"
        ? "normal"
        : scenario;

    console.log(
      `[SimulationController] Running "${normalizedScenario}" (${severity}) simulation: "${source}" → "${destination}"`
    );

    const startTime = Date.now();

    // Step 1: Fetch base routes
    const baseRoutes = await mapsService.getRoutes(source, destination, mode);

    // Step 2: Fetch base weather & traffic
    const baseWeatherList = await Promise.all(
      baseRoutes.map(async (route) =>
        weatherService.getRouteWeatherRisk(
          route.startLocation,
          mapsService.getMidpoint(route),
          route.endLocation
        )
      )
    );
    const baseTrafficList = await trafficService.getTrafficRisksForRoutes(baseRoutes);

    // Step 3: Apply simulation scenario
    const {
      routes: simRoutes,
      weatherDataList: simWeather,
      trafficDataList: simTraffic,
      simulation,
      scenarioMeta,
    } = simulationEngine.applySimulation(
      normalizedScenario,
      severity,
      baseRoutes,
      baseWeatherList,
      baseTrafficList
    );

    // Step 4: Build risk payloads with simulation context
    const {
      payloads,
      recommendedRouteId,
      recommendedRouteName,
      delayAvoided,
      riskSummary,
    } = riskBuilder.buildAllRiskPayloads(simRoutes, simWeather, simTraffic, simulation);

    // Step 5: AI analysis with simulation context
    const [aiAnalysis, agenticAi] = await Promise.all([
      geminiService.analyzeRiskWithGemini(payloads, source, destination).catch((err) => {
        console.warn("[SimulationController] Gemini analysis failed (non-fatal):", err.message);
        return null;
      }),
      runAiPipeline({
        source,
        destination,
        routes: simRoutes,
        weatherDataList: simWeather,
        trafficDataList: simTraffic,
        simulationScenario: normalizedScenario,
      }).catch((err) => {
        console.warn("[SimulationController] AI pipeline failed (non-fatal):", err.message);
        return null;
      }),
    ]);

    const processingTime = Date.now() - startTime;
    const frontend = buildFrontendAnalysisView({
      routes: simRoutes,
      riskPayloads: payloads,
      recommendedRouteId,
      recommendedRouteName,
      delayAvoided,
      aiAnalysis,
      agenticAi,
      simulation: scenarioMeta,
    });

    return res.status(200).json({
      success: true,
      data: {
        source,
        destination,
        mode,
        simulation: scenarioMeta,
        routes: simRoutes,
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

module.exports = { runSimulation };
