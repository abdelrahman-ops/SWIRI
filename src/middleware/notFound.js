import ApiError from "../core/ApiError.js";

const notFound = (req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`, "NOT_FOUND"));
};

export { notFound };
