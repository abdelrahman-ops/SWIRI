import ApiError from "../core/ApiError.js";

const validate = (schema) => (req, res, next) => {
  const data = { body: req.body, params: req.params, query: req.query };
  const { error, value } = schema.validate(data, { abortEarly: false, stripUnknown: true });
  if (error) {
    return next(new ApiError(400, "Validation failed", "VALIDATION_ERROR", error.details.map((d) => d.message)));
  }
  req.body = value.body;
  req.params = value.params;
  req.query = value.query;
  return next();
};

export { validate };
