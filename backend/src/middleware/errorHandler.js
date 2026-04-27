/**
 * middleware/errorHandler.js
 * Global error-handling middleware.
 */

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;

  console.error(`[ErrorHandler] ${err.message}`);
  if (process.env.NODE_ENV !== "production") {
    console.error(err.stack);
  }

  return res.status(statusCode).json({
    success: false,
    error: {
      message: err.message || "Internal Server Error",
      code: err.code || "INTERNAL_ERROR",
      ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
    },
  });
};

module.exports = errorHandler;
