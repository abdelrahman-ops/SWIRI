import jwt from "jsonwebtoken";

const signToken = (user) =>
    jwt.sign(
        {
            sub: user.id,
            role: user.role
        },
            process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

export { signToken };
