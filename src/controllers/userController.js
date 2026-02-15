import User from "../models/User.js";

const normalizePhone = (phone = "") => phone.replace(/\s+/g, "").trim();

const publicUser = (userDoc) => {
  const user = userDoc.toObject ? userDoc.toObject() : userDoc;
  const { passwordHash, ...safeUser } = user;
  return safeUser;
};

const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).populate("children");
    return res.json({ user: publicUser(user) });
  } catch (err) {
    return next(err);
  }
};

const updateMe = async (req, res, next) => {
  try {
    const updates = {
      name: req.body.name,
      phone: req.body.phone ? normalizePhone(req.body.phone) : undefined
    };
    const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true });
    return res.json({ user: publicUser(user) });
  } catch (err) {
    return next(err);
  }
};

export { getMe, updateMe };
