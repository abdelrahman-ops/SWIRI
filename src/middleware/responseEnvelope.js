const responseEnvelope = (req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = (payload) => {
    if (
      payload &&
      (Object.prototype.hasOwnProperty.call(payload, "success") ||
        Object.prototype.hasOwnProperty.call(payload, "error"))
    ) {
      return originalJson(payload);
    }

    const statusCode = res.statusCode || 200;
    const message =
      statusCode === 201
        ? "Resource created"
        : statusCode === 204
          ? "No content"
          : "Request successful";

    return originalJson({
      success: true,
      statusCode,
      message,
      data: payload,
      meta: null,
      requestId: res.locals.requestId,
      timestamp: new Date().toISOString()
    });
  };

  next();
};

export { responseEnvelope };
