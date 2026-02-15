import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { signToken } from "../utils/token.js";

const normalizePhone = (phone = "") => phone.replace(/\s+/g, "").trim();

const publicUser = (userDoc) => {
  const user = userDoc.toObject ? userDoc.toObject() : userDoc;
  const { passwordHash, ...safeUser } = user;
  return safeUser;
};

const register = async (req, res, next) => {
  try {
    const {
      name,
      email,
      phone,
      password,
      confirmPassword,
      role,
      schoolId,
      agreedToTerms
    } = req.body;

    if (password !== confirmPassword) {
      return res.status(400).json({
        error: { message: "Password and confirm password do not match", status: 400 }
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedPhone = normalizePhone(phone);

    const exists = await User.findOne({
      $or: [{ email: normalizedEmail }, { phone: normalizedPhone }]
    });
    if (exists) {
      return res.status(409).json({
        error: { message: "Email or phone already in use", status: 409 }
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      name: name || normalizedEmail.split("@")[0],
      email: normalizedEmail,
      phone: normalizedPhone,
      passwordHash,
      role,
      school: schoolId || undefined,
      termsAcceptedAt: agreedToTerms ? new Date() : undefined,
      authProvider: "password"
    });

    const token = signToken(user);
    return res.status(201).json({ token, user: publicUser(user) });
  } catch (err) {
    return next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const { identifier, email, phone, password } = req.body;
    const loginId = (identifier || email || phone || "").trim();
    const isEmail = loginId.includes("@");
    const query = isEmail
      ? { email: loginId.toLowerCase() }
      : { phone: normalizePhone(loginId) };

    const user = await User.findOne(query).populate("children");
    if (!user) {
      return res.status(401).json({ error: { message: "Invalid credentials", status: 401 } });
    }

    if (user.authProvider !== "password") {
      return res.status(401).json({
        error: { message: "Use social login for this account", status: 401 }
      });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: { message: "Invalid credentials", status: 401 } });
    }

    const token = signToken(user);
    return res.json({ token, user: publicUser(user) });
  } catch (err) {
    return next(err);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const { identifier } = req.body;
    const loginId = (identifier || "").trim();

    if (loginId) {
      const query = loginId.includes("@")
        ? { email: loginId.toLowerCase() }
        : { phone: normalizePhone(loginId) };
      await User.findOne(query);
    }

    return res.json({
      message: "If an account exists, password reset instructions have been sent"
    });
  } catch (err) {
    return next(err);
  }
};

export { register, login, forgotPassword };
