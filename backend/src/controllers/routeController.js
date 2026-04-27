/**
 * controllers/routeController.js
 * Handles: POST /api/route
 *
 * Fetches route alternatives and returns normalised route metadata.
 * This is a lightweight endpoint — no weather/traffic/AI analysis.
 */

const mapsService = require("../services/mapsService");

/**
 * POST /api/route
 * Body: { source, destination, mode? }
 */
const getRoutes = async (req, res, next) => {
  try {
    const { source, destination, mode = "driving" } = req.body;

    console.log(`[RouteController] Fetching routes: "${source}" → "${destination}" (${mode})`);

    const routes = await mapsService.getRoutes(source, destination, mode);

    return res.status(200).json({
      success: true,
      data: {
        source,
        destination,
        mode,
        routeCount: routes.length,
        routes,
      },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = { getRoutes };
