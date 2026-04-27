/**
 * config/apiKeys.js
 * Centralized API key & config loading from environment variables.
 */

require("dotenv").config();

const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || "development",

  googleMapsKey: process.env.GOOGLE_MAPS_KEY || "",
  weatherApiKey: process.env.WEATHER_API_KEY || "",
  geminiApiKey: process.env.GEMINI_API_KEY || "",

  // When true, all external API calls fall back to realistic mock data
  useMockData:
    process.env.USE_MOCK_DATA === "true" || !process.env.GOOGLE_MAPS_KEY,
};

module.exports = config;
