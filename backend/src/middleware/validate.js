/**
 * middleware/validate.js
 * Joi-based request body validation middleware factory.
 */

const Joi = require("joi");

/**
 * Returns an Express middleware that validates req.body against `schema`.
 * On failure it immediately responds with 400 and detailed error messages.
 */
const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    return res.status(400).json({
      success: false,
      error: {
        message: "Validation failed",
        code: "VALIDATION_ERROR",
        details: error.details.map((d) => d.message),
      },
    });
  }

  req.body = value; // use sanitised value
  return next();
};

// ── Shared schemas ────────────────────────────────────────────────────────────

const routeSchema = Joi.object({
  source: Joi.string().trim().min(2).max(200).required().messages({
    "string.empty": "Source location is required",
    "string.min": "Source must be at least 2 characters",
  }),
  destination: Joi.string().trim().min(2).max(200).required().messages({
    "string.empty": "Destination location is required",
    "string.min": "Destination must be at least 2 characters",
  }),
  mode: Joi.string()
    .valid("driving", "walking", "bicycling", "transit")
    .default("driving"),
});

const simulationSchema = Joi.object({
  source: Joi.string().trim().min(2).max(200).required(),
  destination: Joi.string().trim().min(2).max(200).required(),
  mode: Joi.string()
    .valid("driving", "walking", "bicycling", "transit")
    .default("driving"),
  scenario: Joi.string()
    .valid("flood", "storm", "traffic_accident", "accident", "normal", "none")
    .required()
    .messages({
      "any.only":
        "Scenario must be one of: flood, storm, traffic_accident, accident, normal, none",
    }),
  severity: Joi.string().valid("low", "medium", "high", "critical").default("high"),
});

const analyzeRouteSchema = Joi.object({
  source: Joi.string().trim().min(2).max(200).required(),
  destination: Joi.string().trim().min(2).max(200).required(),
  mode: Joi.string()
    .valid("driving", "walking", "bicycling", "transit")
    .default("driving"),
  simulationScenario: Joi.string()
    .valid("flood", "storm", "traffic_accident", "accident", "normal", "none", null)
    .optional()
    .allow(null, ""),
});

module.exports = {
  validate,
  routeSchema,
  simulationSchema,
  analyzeRouteSchema,
};
