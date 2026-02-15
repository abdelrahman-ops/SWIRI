import express from "express";
import Joi from "joi";
import { auth } from "../middleware/auth.js";
import { roleGuard } from "../middleware/role.js";
import { validate } from "../middleware/validate.js";
import { createSchool, listSchools } from "../controllers/schoolController.js";

const router = express.Router();

router.post(
  "/",
  auth,
  roleGuard("school", "admin"),
  validate(
    Joi.object({
      body: Joi.object({
        name: Joi.string().min(2).required(),
        address: Joi.string().allow("").optional(),
        coordinates: Joi.array().items(Joi.number()).length(2).optional()
      }).required(),
      params: Joi.object({}),
      query: Joi.object({})
    })
  ),
  createSchool
);

router.get("/", auth, listSchools);

export default router;
