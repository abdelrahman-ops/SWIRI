import express from "express";
import Joi from "joi";
import { register, login, forgotPassword } from "../controllers/authController.js";
import { validate } from "../middleware/validate.js";

const router = express.Router();

router.post(
  "/signup",
  validate(
    Joi.object({
      body: Joi.object({
        name: Joi.string().min(2).optional(),
        email: Joi.string().email().required(),
        phone: Joi.string().min(6).required(),
        password: Joi.string().min(6).required(),
        confirmPassword: Joi.string().min(6).required(),
        agreedToTerms: Joi.boolean().valid(true).required(),
        role: Joi.string().valid("parent", "school", "staff", "admin", "driver").default("parent"),
        schoolId: Joi.string().optional()
      }).required(),
      params: Joi.object({}),
      query: Joi.object({})
    })
  ),
  register
);

router.post(
  "/register",
  validate(
    Joi.object({
      body: Joi.object({
        name: Joi.string().min(2).optional(),
        email: Joi.string().email().required(),
        phone: Joi.string().min(6).required(),
        password: Joi.string().min(6).required(),
        confirmPassword: Joi.string().min(6).required(),
        agreedToTerms: Joi.boolean().valid(true).required(),
        role: Joi.string().valid("parent", "school", "staff", "admin", "driver").default("parent"),
        schoolId: Joi.string().optional()
      }).required(),
      params: Joi.object({}),
      query: Joi.object({})
    })
  ),
  register
);

router.post(
  "/login",
  validate(
    Joi.object({
      body: Joi.object({
        identifier: Joi.string().optional(),
        email: Joi.string().email().optional(),
        phone: Joi.string().optional(),
        password: Joi.string().required()
      })
        .or("identifier", "email", "phone")
        .required(),
      params: Joi.object({}),
      query: Joi.object({})
    })
  ),
  login
);

router.post(
  "/forgot-password",
  validate(
    Joi.object({
      body: Joi.object({
        identifier: Joi.string().required()
      }).required(),
      params: Joi.object({}),
      query: Joi.object({})
    })
  ),
  forgotPassword
);

export default router;
