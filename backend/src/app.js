/**
 * app.js
 * Express application setup — middleware, routes, and error handling.
 * Separated from server.js to allow easy testing without starting the HTTP server.
 */

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
const errorHandler = require("./middleware/errorHandler");

// Routes
const routeRoutes = require("./routes/routeRoutes");
const analysisRoutes = require("./routes/analysisRoutes");

const app = express();
const frontendRoot = path.resolve(__dirname, "..", "..");

// ── Middleware ────────────────────────────────────────────────────────────────

// CORS — allow any origin in dev; tighten in production
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? process.env.FRONTEND_ORIGIN || "https://sentinelchain.app"
        : (origin, callback) => callback(null, true), // allow all origins in dev
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// Body parsing
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// HTTP logging
app.use(
  morgan(process.env.NODE_ENV === "production" ? "combined" : "dev")
);

// ── Static Frontend ───────────────────────────────────────────────────────────

app.use(
  express.static(frontendRoot, {
    extensions: ["html"],
    index: "index.html",
  })
);

// ── Health Check ──────────────────────────────────────────────────────────────

app.get("/api", (_req, res) => {
  res.status(200).json({
    service: "SentinelChain Lite API",
    version: "1.0.0",
    status: "operational",
    description: "AI-powered emergency routing assistant backend",
    timestamp: new Date().toISOString(),
    endpoints: {
      "POST /api/route": "Fetch route alternatives",
      "POST /api/analyze-route": "Full risk analysis pipeline (routes + weather + traffic + AI)",
      "POST /api/weather": "Weather risk for a route",
      "POST /api/traffic": "Traffic congestion risk for a route",
      "POST /api/simulate": "Run disaster scenario simulation",
      "GET  /api/scenarios": "List available simulation scenarios",
    },
  });
});

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "healthy", timestamp: new Date().toISOString() });
});

app.get("/api/config", (_req, res) => {
  res.status(200).json({
    success: true,
    data: {
      modes: [
        { value: "driving", label: "Road Delivery" },
        { value: "walking", label: "On-foot Courier" },
        { value: "bicycling", label: "Bike Responder" },
        { value: "transit", label: "Public Transit" },
      ],
      severities: ["low", "medium", "high", "critical"],
    },
  });
});

// ── API Routes ────────────────────────────────────────────────────────────────

app.use("/api/route", routeRoutes);
app.use("/api", analysisRoutes);

// ── 404 Handler ───────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      message: `Endpoint not found: ${req.method} ${req.originalUrl}`,
      code: "NOT_FOUND",
    },
  });
});

// ── Global Error Handler ──────────────────────────────────────────────────────

app.use(errorHandler);

module.exports = app;
