import express from "express";
import Joi from "joi";
import { auth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { listAlerts, createAlert } from "../controllers/alertController.js";

const router = express.Router();

router.get(
    "/",
    auth,
    validate(
        Joi.object({
        body: Joi.object({}),
        params: Joi.object({}),
        query: Joi.object({ childId: Joi.string().optional() })
        })
    ),
    listAlerts
);

router.post(
  "/",
  auth,
  validate(
    Joi.object({
      body: Joi.object({
        type: Joi.string().valid("geofence", "sos", "vitals", "movement", "custom").required(),
        severity: Joi.string().valid("low", "medium", "high", "critical").optional(),
        childId: Joi.string().required(),
        message: Joi.string().required(),
        coordinates: Joi.array().items(Joi.number()).length(2).optional(),
        imageUrl: Joi.string().uri().optional(),
        recipients: Joi.array().items(Joi.string()).optional()
      }).required(),
      params: Joi.object({}),
      query: Joi.object({})
    })
  ),
  createAlert
);

export default router;
