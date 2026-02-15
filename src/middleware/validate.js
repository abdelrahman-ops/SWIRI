const validate = (schema) => (req, res, next) => {
  const data = { body: req.body, params: req.params, query: req.query };
  const { error, value } = schema.validate(data, { abortEarly: false, stripUnknown: true });
  if (error) {
    return res.status(400).json({
      error: {
        message: "Validation error",
        details: error.details.map((d) => d.message)
      }
    });
  }
  req.body = value.body;
  req.params = value.params;
  req.query = value.query;
  return next();
};

export { validate };
