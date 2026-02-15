import express from "express";
import Joi from "joi";
import { auth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { createLocation, getLatestLocation } from "../controllers/locationController.js";

const router = express.Router();

router.post(
  "/",
  auth,
  validate(
    Joi.object({
      body: Joi.object({
        childId: Joi.string().required(),
        deviceId: Joi.string().optional(),
        coordinates: Joi.array().items(Joi.number()).length(2).required(),
        accuracy: Joi.number().optional(),
        speed: Joi.number().optional(),
        heading: Joi.number().optional(),
        recordedAt: Joi.date().optional()
      }).required(),
      params: Joi.object({}),
      query: Joi.object({})
    })
  ),
  createLocation
);

router.get(
  "/latest/:childId",
  auth,
  validate(
    Joi.object({
      body: Joi.object({}),
      params: Joi.object({ childId: Joi.string().required() }).required(),
      query: Joi.object({})
    })
  ),
  getLatestLocation
);

export default router;
