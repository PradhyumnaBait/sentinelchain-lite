/**
 * server.js
 * HTTP server bootstrap — loads .env, starts Express, and handles
 * graceful shutdown on SIGTERM / SIGINT.
 */

require("dotenv").config();
const app = require("./app");
const config = require("./config/apiKeys");

const PORT = config.port;

const server = app.listen(PORT, () => {
  console.log("\n╔════════════════════════════════════════════════╗");
  console.log("║       SentinelChain Lite — Backend Server       ║");
  console.log("╚════════════════════════════════════════════════╝");
  console.log(`\n🚀  Server running on http://localhost:${PORT}`);
  console.log(`📌  Environment : ${config.nodeEnv}`);
  console.log(`🗺️   Maps API   : ${config.googleMapsKey ? "✅ Configured" : "⚠️  Missing (mock mode)"}`);
  console.log(`🌤️   Weather API: ${config.weatherApiKey ? "✅ Configured" : "⚠️  Missing (mock mode)"}`);
  console.log(`🤖  Gemini AI  : ${config.geminiApiKey ? "✅ Configured" : "⚠️  Missing (rule-based fallback)"}`);
  console.log(`🔮  Mock Data  : ${config.useMockData ? "ON" : "OFF"}`);
  console.log("\nAvailable endpoints:");
  console.log("  POST /api/route           — Fetch route alternatives");
  console.log("  POST /api/analyze-route   — Full AI risk analysis");
  console.log("  POST /api/weather         — Weather risk");
  console.log("  POST /api/traffic         — Traffic risk");
  console.log("  POST /api/simulate        — Disaster simulation");
  console.log("  GET  /api/scenarios       — List scenarios");
  console.log("\nReady to serve emergency routing requests ✅\n");
});

// ── Graceful Shutdown ─────────────────────────────────────────────────────────

const shutdown = (signal) => {
  console.log(`\n[Server] Received ${signal}. Shutting down gracefully…`);
  server.close(() => {
    console.log("[Server] HTTP server closed. Goodbye.\n");
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.error("[Server] Force-closing after timeout.");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  console.error("[Server] Unhandled Promise Rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[Server] Uncaught Exception:", err);
  process.exit(1);
});

module.exports = server;
