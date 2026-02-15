import express from "express";
import Joi from "joi";
import { auth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { recordAttendance, listAttendance } from "../controllers/attendanceController.js";

const router = express.Router();

router.post(
  "/",
  auth,
  validate(
    Joi.object({
      body: Joi.object({
        childId: Joi.string().required(),
        schoolId: Joi.string().required(),
        status: Joi.string().valid("in", "out").required(),
        source: Joi.string().valid("nfc", "ble", "manual").optional()
      }).required(),
      params: Joi.object({}),
      query: Joi.object({})
    })
  ),
  recordAttendance
);

router.get(
  "/",
  auth,
  validate(
    Joi.object({
      body: Joi.object({}),
      params: Joi.object({}),
      query: Joi.object({
        schoolId: Joi.string().optional(),
        childId: Joi.string().optional()
      })
    })
  ),
  listAttendance
);

export default router;
