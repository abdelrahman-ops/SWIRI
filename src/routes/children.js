import express from "express";
import Joi from "joi";
import { auth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { createChild, listChildren, getChild, updateChild } from "../controllers/childController.js";

const router = express.Router();

router.post(
  "/",
  auth,
  validate(
    Joi.object({
      body: Joi.object({
        name: Joi.string().min(2).required(),
        dateOfBirth: Joi.date().optional(),
        schoolId: Joi.string().optional(),
        guardianIds: Joi.array().items(Joi.string()).optional()
      }).required(),
      params: Joi.object({}),
      query: Joi.object({})
    })
  ),
  createChild
);

router.get("/", auth, listChildren);

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
  getChild
);

router.patch(
  "/:childId",
  auth,
  validate(
    Joi.object({
      body: Joi.object({
        name: Joi.string().min(2).optional(),
        dateOfBirth: Joi.date().optional(),
        schoolId: Joi.string().optional()
      }).required(),
      params: Joi.object({ childId: Joi.string().required() }).required(),
      query: Joi.object({})
    })
  ),
  updateChild
);

export default router;
