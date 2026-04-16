import { ApiError } from '../utils/api-error.js';
import { ApiResponse } from '../utils/api-response.js';

/**
 * Global error handler middleware
 * Catches all errors and formats them consistently
 */
const errorHandler = (err, req, res, next) => {
  // ========== API ERROR ==========
  if (err instanceof ApiError) {
    console.log(
      `[Error] ${req.method} ${req.path} | Status: ${err.statusCode} | Message: ${err.message}`
    );
    return res.status(err.statusCode).json(
      new ApiResponse(err.statusCode, err.errors || null, err.message)
    );
  }

  // ========== MONGOOSE VALIDATION ERROR ==========
  if (err.name === 'ValidationError') {
    console.log(
      `[ValidationError] ${req.method} ${req.path} | Message: ${err.message}`
    );

    const fieldErrors = Object.keys(err.errors).map((field) => ({
      field,
      message: err.errors[field].message,
    }));

    return res.status(400).json(
      new ApiResponse(400, fieldErrors, 'Validation Error')
    );
  }

  // ========== MONGOOSE CAST ERROR (Invalid ObjectId) ==========
  if (err.name === 'CastError') {
    console.log(
      `[CastError] ${req.method} ${req.path} | Invalid ID: ${err.value}`
    );
    return res.status(400).json(
      new ApiResponse(400, null, 'Invalid ID format')
    );
  }

  // ========== JWT ERROR ==========
  if (err.name === 'JsonWebTokenError') {
    console.log(
      `[JWTError] ${req.method} ${req.path} | Message: ${err.message}`
    );
    return res.status(401).json(
      new ApiResponse(401, null, 'Invalid token')
    );
  }

  // ========== UNEXPECTED ERROR ==========
  console.error(
    `[UnexpectedError] ${req.method} ${req.path} | Stack:`,
    err.stack || err.message
  );

  return res.status(500).json(
    new ApiResponse(500, null, 'Internal server error')
  );
};

/**
 * 404 Not Found handler
 * Catches unmatched routes and passes to error middleware
 */
const notFoundHandler = (req, res, next) => {
  const error = new ApiError(404, `Route ${req.originalUrl} not found`);
  next(error);
};

export { errorHandler, notFoundHandler };
