import express from "express";
import Joi from "joi";
import { auth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { getMe, updateMe } from "../controllers/userController.js";

const router = express.Router();

router.get("/me", auth, getMe);

router.patch(
  "/me",
  auth,
  validate(
    Joi.object({
      body: Joi.object({
        name: Joi.string().min(2).optional(),
        phone: Joi.string().allow("").optional()
      }).required(),
      params: Joi.object({}),
      query: Joi.object({})
    })
  ),
  updateMe
);

export default router;
