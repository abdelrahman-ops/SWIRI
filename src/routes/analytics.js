import express from "express";
import Joi from "joi";
import { auth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { behaviorInsights } from "../controllers/analyticsController.js";

const router = express.Router();

router.get(
  "/behavior/:childId",
  auth,
  validate(
    Joi.object({
      body: Joi.object({}),
      params: Joi.object({ childId: Joi.string().required() }).required(),
      query: Joi.object({})
    })
  ),
  behaviorInsights
);

export default router;
