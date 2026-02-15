import express from "express";
import Joi from "joi";
import { auth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { createSummary, listSummaries } from "../controllers/activityController.js";

const router = express.Router();

router.post(
  "/",
  auth,
  validate(
    Joi.object({
      body: Joi.object({
        childId: Joi.string().required(),
        date: Joi.date().required(),
        steps: Joi.number().min(0).optional(),
        activeMinutes: Joi.number().min(0).optional(),
        restMinutes: Joi.number().min(0).optional(),
        heartRateAvg: Joi.number().min(0).optional(),
        heartRateMax: Joi.number().min(0).optional()
      }).required(),
      params: Joi.object({}),
      query: Joi.object({})
    })
  ),
  createSummary
);

router.get(
  "/:childId",
  auth,
  validate(
    Joi.object({
      body: Joi.object({}),
      params: Joi.object({ childId: Joi.string().required() }).required(),
      query: Joi.object({})
    })
  ),
  listSummaries
);

export default router;
