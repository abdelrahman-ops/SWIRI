import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { signToken } from "../utils/token.js";
import ApiError from "../core/ApiError.js";
import ApiResponse from "../core/ApiResponse.js";

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
      return next(new ApiError(400, "Password and confirm password do not match", "VALIDATION_ERROR"));
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedPhone = normalizePhone(phone);

    const exists = await User.findOne({
      $or: [{ email: normalizedEmail }, { phone: normalizedPhone }]
    });
    if (exists) {
      return next(new ApiError(409, "Email or phone already in use", "CONFLICT"));
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
    return ApiResponse.created(res, { token, user: publicUser(user) }, "Account created successfully");
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
      return next(new ApiError(401, "Invalid credentials", "AUTH_FAILED"));
    }

    if (user.authProvider !== "password") {
      return next(new ApiError(401, "Use social login for this account", "AUTH_PROVIDER_MISMATCH"));
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return next(new ApiError(401, "Invalid credentials", "AUTH_FAILED"));
    }

    const token = signToken(user);
    return ApiResponse.ok(res, { token, user: publicUser(user) }, "Login successful");
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

    return ApiResponse.ok(
      res,
      { sent: true },
      "If an account exists, password reset instructions have been sent"
    );
  } catch (err) {
    return next(err);
  }
};

export { register, login, forgotPassword };
