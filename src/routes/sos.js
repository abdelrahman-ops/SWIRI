import express from "express";
import Joi from "joi";
import { auth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { triggerSos, resolveSos } from "../controllers/sosController.js";

const router = express.Router();

router.post(
  "/",
  auth,
  validate(
    Joi.object({
      body: Joi.object({
        childId: Joi.string().required(),
        triggeredBy: Joi.string().valid("child", "device", "auto").optional(),
        coordinates: Joi.array().items(Joi.number()).length(2).optional(),
        imageUrl: Joi.string().uri().optional()
      }).required(),
      params: Joi.object({}),
      query: Joi.object({})
    })
  ),
  triggerSos
);

router.patch(
  "/:sosId/resolve",
  auth,
  validate(
    Joi.object({
      body: Joi.object({}),
      params: Joi.object({ sosId: Joi.string().required() }).required(),
      query: Joi.object({})
    })
  ),
  resolveSos
);

export default router;
