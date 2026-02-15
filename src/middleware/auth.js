import jwt from "jsonwebtoken";
import User from "../models/User.js";
import ApiError from "../core/ApiError.js";

const auth = async (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) {
      return next(new ApiError(401, "Unauthorized", "UNAUTHORIZED"));
    }
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub);
    if (!user) {
      return next(new ApiError(401, "Unauthorized", "UNAUTHORIZED"));
    }
    req.user = user;
    return next();
  } catch (err) {
    return next(new ApiError(401, "Unauthorized", "UNAUTHORIZED"));
  }
};

export { auth };
