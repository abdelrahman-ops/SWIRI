import express from "express";
import Joi from "joi";
import { auth } from "../middleware/auth.js";
import { roleGuard } from "../middleware/role.js";
import { validate } from "../middleware/validate.js";
import { registerDevice, assignDevice, listDevices } from "../controllers/deviceController.js";

const router = express.Router();

router.post(
  "/",
  auth,
  roleGuard("admin", "school"),
  validate(
    Joi.object({
      body: Joi.object({
        serialNumber: Joi.string().required(),
        type: Joi.string().valid("watch", "band", "tracker").optional()
      }).required(),
      params: Joi.object({}),
      query: Joi.object({})
    })
  ),
  registerDevice
);

router.post(
  "/:deviceId/assign",
  auth,
  roleGuard("admin", "school", "parent"),
  validate(
    Joi.object({
      body: Joi.object({
        childId: Joi.string().required()
      }).required(),
      params: Joi.object({ deviceId: Joi.string().required() }).required(),
      query: Joi.object({})
    })
  ),
  assignDevice
);

router.get("/", auth, listDevices);

export default router;
