import express from "express";
import Joi from "joi";
import { auth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { simulateWatchData, simulateScenario, simulateFullDemo, SCENARIO_PRESETS } from "../controllers/simulationController.js";

const router = express.Router();

/**
 * POST /api/simulate/watch-data
 * Send raw watch sensor data through the full pipeline.
 */
router.post(
  "/watch-data",
  auth,
  validate(
    Joi.object({
      body: Joi.object({
        childId: Joi.string().required(),
        coordinates: Joi.array().items(Joi.number()).length(2).optional(),
        heart_rate_raw: Joi.array().items(Joi.number()).min(5).required(),
        accelerometer_raw: Joi.array().items(Joi.number()).min(5).required(),
        source: Joi.string().valid("watch", "band", "manual", "device").optional(),
      }).required(),
      params: Joi.object({}),
      query: Joi.object({}),
    })
  ),
  simulateWatchData
);

/**
 * POST /api/simulate/scenario/:type
 * Auto-generate sensor data for a specific scenario and run the pipeline.
 * type = normal | playing | danger_struggle | danger_freeze | geofence_breach | sos
 */
router.post(
  "/scenario/:type",
  auth,
  validate(
    Joi.object({
      body: Joi.object({
        childId: Joi.string().required(),
        coordinates: Joi.array().items(Joi.number()).length(2).optional(),
      }).required(),
      params: Joi.object({
        type: Joi.string().valid(...Object.keys(SCENARIO_PRESETS)).required(),
      }).required(),
      query: Joi.object({}),
    })
  ),
  simulateScenario
);

/**
 * POST /api/simulate/full-demo
 * Run ALL scenarios for a child. Perfect for presentation demos.
 */
router.post(
  "/full-demo",
  auth,
  validate(
    Joi.object({
      body: Joi.object({
        childId: Joi.string().required(),
        coordinates: Joi.array().items(Joi.number()).length(2).optional(),
      }).required(),
      params: Joi.object({}),
      query: Joi.object({}),
    })
  ),
  simulateFullDemo
);

export default router;
