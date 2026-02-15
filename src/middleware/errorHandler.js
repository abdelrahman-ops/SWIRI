import ApiError from "../core/ApiError.js";

const normalizeError = (err) => {
  if (err instanceof ApiError) return err;

  if (err?.name === "ValidationError") {
    const details = Object.values(err.errors || {}).map((v) => v.message);
    return new ApiError(400, "Validation failed", "VALIDATION_ERROR", details);
  }

  if (err?.name === "CastError") {
    return new ApiError(400, `Invalid ${err.path}`, "INVALID_ID", { path: err.path, value: err.value });
  }

  if (err?.code === 11000) {
    const keys = Object.keys(err.keyPattern || err.keyValue || {});
    return new ApiError(409, `Duplicate value for ${keys.join(", ") || "unique field"}`, "DUPLICATE_RESOURCE", err.keyValue || null);
  }

  if (err?.name === "JsonWebTokenError" || err?.name === "TokenExpiredError") {
    return new ApiError(401, "Invalid or expired token", "AUTH_ERROR");
  }

  return new ApiError(500, "Internal server error", "INTERNAL_ERROR");
};

const errorHandler = (err, req, res, next) => {
  const normalized = normalizeError(err);
  const isDev = process.env.NODE_ENV !== "production";

  res.status(normalized.statusCode).json({
    success: false,
    statusCode: normalized.statusCode,
    error: {
      code: normalized.code,
      message: normalized.message,
      details: normalized.details
    },
    requestId: res.locals.requestId,
    timestamp: new Date().toISOString(),
    ...(isDev ? { stack: err.stack } : {})
  });
};

export { errorHandler };
