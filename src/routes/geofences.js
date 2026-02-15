import express from "express";
import Joi from "joi";
import { auth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { createGeofence, listGeofences } from "../controllers/geofenceController.js";

const router = express.Router();

router.post(
  "/",
  auth,
  validate(
    Joi.object({
      body: Joi.object({
        name: Joi.string().required(),
        childId: Joi.string().required(),
        coordinates: Joi.array().items(Joi.number()).length(2).required(),
        radiusM: Joi.number().min(5).required(),
        schedule: Joi.object({
          days: Joi.array().items(Joi.number().min(0).max(6)).optional(),
          start: Joi.string().optional(),
          end: Joi.string().optional()
        }).optional()
      }).required(),
      params: Joi.object({}),
      query: Joi.object({})
    })
  ),
  createGeofence
);

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
  listGeofences
);

export default router;
