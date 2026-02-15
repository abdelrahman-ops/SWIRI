import ApiError from "../core/ApiError.js";

const roleGuard = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(new ApiError(403, "Forbidden", "FORBIDDEN"));
  }
  return next();
};

export { roleGuard };
