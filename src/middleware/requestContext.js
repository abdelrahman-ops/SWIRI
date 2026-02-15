import { randomUUID } from "crypto";

const requestContext = (req, res, next) => {
  res.locals.requestId = randomUUID();
  res.setHeader("x-request-id", res.locals.requestId);
  next();
};

export { requestContext };
