/**
 * routes/routeRoutes.js
 * Express router for route-related endpoints.
 */

const express = require("express");
const router = express.Router();
const { getRoutes } = require("../controllers/routeController");
const { validate, routeSchema } = require("../middleware/validate");

/**
 * POST /api/route
 * Fetch route alternatives between source and destination.
 *
 * Body:
 *   { source: string, destination: string, mode?: string }
 *
 * Response:
 *   { success, data: { routes: RouteObject[] } }
 */
router.post("/", validate(routeSchema), getRoutes);

module.exports = router;
