import jwt from "jsonwebtoken";
import User from "../models/User.js";

const auth = async (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: { message: "Unauthorized", status: 401 } });
    }
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub);
    if (!user) {
      return res.status(401).json({ error: { message: "Unauthorized", status: 401 } });
    }
    req.user = user;
    return next();
  } catch (err) {
    return res.status(401).json({ error: { message: "Unauthorized", status: 401 } });
  }
};

export { auth };
