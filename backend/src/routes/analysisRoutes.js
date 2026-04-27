/**
 * routes/analysisRoutes.js
 * Express router for analysis, weather, traffic, and simulation endpoints.
 */

const express = require("express");
const router = express.Router();

const {
  analyzeRoute,
  getWeatherRisk,
  getTrafficRisk,
  listScenarios,
} = require("../controllers/analysisController");

const { runSimulation } = require("../controllers/simulationController");

const {
  validate,
  routeSchema,
  simulationSchema,
  analyzeRouteSchema,
} = require("../middleware/validate");

/**
 * POST /api/analyze-route
 * Full pipeline: routes + weather + traffic + AI risk analysis.
 *
 * Body:
 *   { source, destination, mode? }
 *
 * Response:
 *   { success, data: { routes, riskPayloads, aiAnalysis, recommendedRouteId, ... } }
 */
router.post("/analyze-route", validate(analyzeRouteSchema), analyzeRoute);

/**
 * POST /api/weather
 * Weather risk for a source-destination pair.
 *
 * Body: { source, destination }
 */
router.post("/weather", validate(routeSchema), getWeatherRisk);

/**
 * POST /api/traffic
 * Traffic congestion risk for a source-destination pair.
 *
 * Body: { source, destination }
 */
router.post("/traffic", validate(routeSchema), getTrafficRisk);

/**
 * POST /api/simulate
 * Simulate a disaster scenario over the route analysis.
 *
 * Body: { source, destination, scenario, severity? }
 */
router.post("/simulate", validate(simulationSchema), runSimulation);

/**
 * GET /api/scenarios
 * Returns available simulation scenario keys and metadata.
 */
router.get("/scenarios", listScenarios);

module.exports = router;
