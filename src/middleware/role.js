const roleGuard = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: { message: "Forbidden", status: 403 } });
  }
  return next();
};

export { roleGuard };
